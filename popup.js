import { registry } from './endpoints/registry.js';

const noteBox       = document.getElementById('note');
const titleEl       = document.getElementById('title');
const statusEl      = document.getElementById('status');
const deleteBtn     = document.getElementById('deleteBtn');
const closeBtn      = document.getElementById('closeBtn');
const settingsBtn   = document.getElementById('settingsBtn');
const endpointLabel = document.getElementById('endpoint-label');
const actionsEl     = document.getElementById('actions');

// Read context passed via URL query params (from content_script)
const params       = new URLSearchParams(location.search);
const paramTitle   = params.get('title') || '';
const paramUrl     = params.get('url')   || '';
const paramNote    = params.get('note')  || '';
const selectedText = params.get('selected') || '';

// Pre-fill note: selected page text takes priority over context menu note
noteBox.value = selectedText || paramNote;

let savedId          = null;
let debTimer         = null;
let activeEndpointId = null;

function setStatus(text, cls = '') {
    statusEl.textContent = text;
    statusEl.className   = cls;
}

function sendMsg(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (res?.error) return reject(new Error(res.error));
            resolve(res);
        });
    });
}

function removePopup() {
    window.parent.postMessage({ plainmark: 'close' }, '*');
}

// Settings gear opens options page
settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Close button
closeBtn.addEventListener('click', removePopup);

// Note box: debounced update after initial save
// For local_markdown: runs directly in popup (service worker can't use File System API)
// For other endpoints: routes through service worker
noteBox.addEventListener('input', () => {
    if (!savedId) return;
    setStatus('Updating...');
    clearTimeout(debTimer);
    debTimer = setTimeout(async () => {
        try {
            if (activeEndpointId === 'local_markdown') {
                const ep = registry.getById('local_markdown');
                await ep.update(savedId, noteBox.value);
            } else {
                await sendMsg({ message: 'update', id: savedId, note: noteBox.value });
            }
            setStatus('Updated', 'saved');
        } catch (e) {
            setStatus(e.message, 'error');
        }
    }, 400);
});

// Delete button — same split: local_markdown handled directly, others via service worker
deleteBtn.addEventListener('click', async () => {
    if (!savedId) return;
    setStatus('Deleting...');
    try {
        if (activeEndpointId === 'local_markdown') {
            const ep = registry.getById('local_markdown');
            await ep.delete(savedId);
        } else {
            await sendMsg({ message: 'delete', id: savedId });
        }
        setStatus('Deleted');
        setTimeout(removePopup, 600);
    } catch (e) {
        setStatus(e.message, 'error');
    }
});

// Show a "Grant file access" button — clicking it IS a user gesture so requestPermission works
function showGrantButton(ep) {
    if (document.getElementById('grantBtn')) return; // already shown
    setStatus('File access needed');
    const btn = document.createElement('button');
    btn.id          = 'grantBtn';
    btn.textContent = 'Grant file access';
    btn.style.cssText = 'font-size:11px;padding:2px 8px;border:1px solid #4a90e2;background:none;color:#4a90e2;border-radius:3px;cursor:pointer;margin-right:4px;';
    btn.addEventListener('click', async () => {
        btn.remove();
        const granted = await ep.requestPermission(); // user gesture satisfies the requirement
        if (granted) {
            const result = await ep.flushQueue();
            setStatus(result.ok ? result.message : result.message, result.ok ? 'saved' : 'error');
        } else {
            setStatus('Permission denied', 'error');
        }
    });
    actionsEl.prepend(btn);
}

async function handleLocalMarkdownFlush() {
    const ep = registry.getById('local_markdown');
    const result = await ep.flushQueue();
    if (result.needsPermission) {
        showGrantButton(ep);
    } else if (result.ok && result.count > 0) {
        setStatus(result.message, 'saved');
    } else if (!result.ok) {
        setStatus(result.message, 'error');
    }
}

async function saveBookmark(title, url) {
    setStatus('Saving...');
    try {
        const res = await sendMsg({ message: 'add', title, url, note: noteBox.value });
        savedId = res.id;
        setStatus('Saved', 'saved');
        deleteBtn.style.display = 'inline-block';

        if (activeEndpointId === 'local_markdown') {
            await handleLocalMarkdownFlush();
        }
    } catch (e) {
        setStatus(e.message, 'error');
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const config     = await sendMsg({ message: 'getConfig' });
        activeEndpointId = config.endpointId;
        endpointLabel.textContent = config.endpointName || '';
    } catch (_) {}

    const title = paramTitle || '(unknown page)';
    const url   = paramUrl   || '';

    titleEl.textContent = title;
    titleEl.title       = title;

    await saveBookmark(title, url);
    noteBox.focus();
});
