import { registry } from './endpoints/registry.js';

const noteBox       = document.getElementById('note');
const titleEl       = document.getElementById('title');
const statusEl      = document.getElementById('status');
const deleteBtn     = document.getElementById('deleteBtn');
const closeBtn      = document.getElementById('closeBtn');
const settingsBtn   = document.getElementById('settingsBtn');
const endpointLabel = document.getElementById('endpoint-label');

// Read context passed via URL query params (from content_script)
const params       = new URLSearchParams(location.search);
const paramTitle   = params.get('title') || '';
const paramUrl     = params.get('url')   || '';
const paramNote    = params.get('note')  || '';
const selectedText = params.get('selected') || '';

// Pre-fill note: selected page text takes priority over context menu note
noteBox.value = selectedText || paramNote;

let savedId  = null;
let debTimer = null;

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
    // Post to parent window where content_script.js listens
    window.parent.postMessage({ plainmark: 'close' }, '*');
}

// Settings gear opens options page
settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Note box: debounced update after initial save
noteBox.addEventListener('input', () => {
    if (!savedId) return;
    setStatus('Updating...');
    clearTimeout(debTimer);
    debTimer = setTimeout(() => {
        sendMsg({ message: 'update', id: savedId, note: noteBox.value })
            .then(() => setStatus('Updated', 'saved'))
            .catch(e => setStatus(e.message, 'error'));
    }, 400);
});

// Close button
closeBtn.addEventListener('click', removePopup);

// Delete button
deleteBtn.addEventListener('click', () => {
    if (!savedId) return;
    setStatus('Deleting...');
    sendMsg({ message: 'delete', id: savedId })
        .then(() => { setStatus('Deleted'); setTimeout(removePopup, 600); })
        .catch(e => setStatus(e.message, 'error'));
});

async function saveBookmark(title, url) {
    setStatus('Saving...');
    try {
        const res = await sendMsg({ message: 'add', title, url, note: noteBox.value });
        savedId = res.id;
        setStatus('Saved', 'saved');
        deleteBtn.style.display = 'inline-block';

        // If local_markdown endpoint is active, flush the queue now (we're in DOM context)
        const config = await sendMsg({ message: 'getConfig' });
        if (config.endpointId === 'local_markdown') {
            const ep = registry.getById('local_markdown');
            await ep.init({});
            const flush = await ep.flushQueue();
            if (!flush.ok) setStatus(flush.message, 'error');
        }
    } catch (e) {
        setStatus(e.message, 'error');
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    // Show active endpoint name
    try {
        const config = await sendMsg({ message: 'getConfig' });
        endpointLabel.textContent = config.endpointName || '';
    } catch (_) {}

    const title = paramTitle || '(unknown page)';
    const url   = paramUrl   || '';

    titleEl.textContent = title;
    titleEl.title       = title;

    await saveBookmark(title, url);
    noteBox.focus();
});
