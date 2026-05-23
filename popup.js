import { registry } from './endpoints/registry.js';

const noteBox       = document.getElementById('note');
const titleEl       = document.getElementById('title');
const statusEl      = document.getElementById('status');
const deleteBtn     = document.getElementById('deleteBtn');
const closeBtn      = document.getElementById('closeBtn');
const settingsBtn   = document.getElementById('settingsBtn');
const endpointLabel = document.getElementById('endpoint-label');
const actionsEl     = document.getElementById('actions');

const params       = new URLSearchParams(location.search);
const paramTitle   = params.get('title') || '';
const paramUrl     = params.get('url')   || '';
const paramNote    = params.get('note')  || '';
const selectedText = params.get('selected') || '';

noteBox.value = selectedText || paramNote;

let savedId          = null;
let debTimer         = null;
let activeEndpointId = null;
// Pre-loaded file handle for local_markdown — avoids IDB round-trip in click handlers,
// which would consume the user-activation required by requestPermission()
let preloadedHandle  = null;

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

settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
closeBtn.addEventListener('click', removePopup);

// Note updates — local_markdown runs directly in popup (service worker can't use File System API)
noteBox.addEventListener('input', () => {
    if (!savedId) return;
    setStatus('Updating…');
    clearTimeout(debTimer);
    debTimer = setTimeout(async () => {
        try {
            if (activeEndpointId === 'local_markdown') {
                await registry.getById('local_markdown').update(savedId, noteBox.value);
            } else {
                await sendMsg({ message: 'update', id: savedId, note: noteBox.value });
            }
            setStatus('Updated', 'saved');
        } catch (e) {
            setStatus(e.message, 'error');
        }
    }, 400);
});

deleteBtn.addEventListener('click', async () => {
    if (!savedId) return;
    setStatus('Deleting…');
    try {
        if (activeEndpointId === 'local_markdown') {
            await registry.getById('local_markdown').delete(savedId);
        } else {
            await sendMsg({ message: 'delete', id: savedId });
        }
        setStatus('Deleted');
        setTimeout(removePopup, 600);
    } catch (e) {
        setStatus(e.message, 'error');
    }
});

// Show a prominent grant-access bar when file permission has lapsed.
// preloadedHandle is already in memory so requestPermission() is the first
// await in the click handler — no IDB lookup in the hot path.
function showGrantBar(fileName) {
    if (document.getElementById('grantBar')) return;

    const bar = document.createElement('div');
    bar.id = 'grantBar';
    bar.style.cssText = [
        'background:#fff3e0', 'border:1px solid #e67e22', 'border-radius:5px',
        'padding:6px 10px', 'font-size:11px', 'color:#a04000',
        'display:flex', 'align-items:center', 'gap:8px', 'margin-bottom:4px',
    ].join(';');

    const msg = document.createElement('span');
    msg.style.flex    = '1';
    msg.textContent   = `Grant access to write to ${fileName || 'your file'}`;

    const btn = document.createElement('button');
    btn.textContent   = 'Grant';
    btn.style.cssText = 'font-size:11px;padding:2px 10px;border:1px solid #e67e22;background:#e67e22;color:#fff;border-radius:3px;cursor:pointer;';

    btn.addEventListener('click', async () => {
        if (!preloadedHandle) return;
        // requestPermission() is the first await — user activation is still valid
        const perm = await preloadedHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
            bar.remove();
            const ep     = registry.getById('local_markdown');
            const result = await ep.flushQueue();
            setStatus(result.ok ? `Saved to ${preloadedHandle.name}` : result.message,
                      result.ok ? 'saved' : 'error');
        } else {
            msg.textContent = 'Permission denied. Open ⚙ Options to try again.';
            btn.remove();
        }
    });

    bar.append(msg, btn);
    // Insert above the footer row
    document.getElementById('footer').before(bar);
}

async function handleLocalMarkdownFlush(ep) {
    const result = await ep.flushQueue();
    if (result.needsPermission) {
        const name = preloadedHandle?.name ?? '';
        showGrantBar(name);
        setStatus('Queued', '');
    } else if (result.ok && result.count > 0) {
        setStatus(`Saved to ${preloadedHandle?.name ?? 'file'}`, 'saved');
    } else if (!result.ok) {
        setStatus(result.message, 'error');
    }
}

async function saveBookmark(title, url) {
    setStatus('Saving…');
    try {
        const res = await sendMsg({ message: 'add', title, url, note: noteBox.value });
        savedId = res.id;
        setStatus('Saved', 'saved');
        deleteBtn.style.display = 'inline-block';

        if (activeEndpointId === 'local_markdown') {
            await handleLocalMarkdownFlush(registry.getById('local_markdown'));
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

    // Pre-load file handle so grant button click has no IDB latency
    if (activeEndpointId === 'local_markdown') {
        const ep = registry.getById('local_markdown');
        preloadedHandle = await ep.getHandle();
    }

    const title = paramTitle || '(unknown page)';
    const url   = paramUrl   || '';
    titleEl.textContent = title;
    titleEl.title       = title;

    await saveBookmark(title, url);
    noteBox.focus();
});
