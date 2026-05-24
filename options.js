import { registry } from './endpoints/registry.js';

const endpointSelectEl   = document.getElementById('endpoint-select');
const endpointWarningEl  = document.getElementById('endpoint-warning');
const settingsFormEl     = document.getElementById('settings-form');
const settingsHeading   = document.getElementById('settings-heading');
const filePickerArea    = document.getElementById('file-picker-area');
const currentFileEl     = document.getElementById('current-file');
const pickFileBtn       = document.getElementById('pick-file-btn');
const grantStep         = document.getElementById('grant-step');
const permStatusEl      = document.getElementById('permission-status');
const grantAccessBtn    = document.getElementById('grant-access-btn');
const queueStep         = document.getElementById('queue-step');
const queueStatusEl     = document.getElementById('queue-status');
const flushBtn          = document.getElementById('flush-btn');
const testBtn           = document.getElementById('test-btn');
const testResultEl      = document.getElementById('test-result');
const browserStorageArea = document.getElementById('browser-storage-area');
const bsCountEl          = document.getElementById('bs-count');
const bsCopyMdBtn        = document.getElementById('bs-copy-md-btn');
const bsCopyJsonBtn      = document.getElementById('bs-copy-json-btn');
const bsDownloadBtn      = document.getElementById('bs-download-btn');
const bsClearBtn         = document.getElementById('bs-clear-btn');
const bsExportResult     = document.getElementById('bs-export-result');

// Pre-loaded handle — populated when local_markdown settings are rendered.
// Storing it here means button click handlers can call handle.requestPermission()
// as their very first await, satisfying the user-activation requirement.
let preloadedHandle = null;

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function init() {
    const activeId = await registry.getActiveId();
    renderEndpointSelect(activeId);
    await renderSettingsForm(activeId);
}

function renderEndpointSelect(activeId) {
    endpointSelectEl.innerHTML = '';
    for (const ep of registry.getAll()) {
        const option = document.createElement('option');
        option.value    = ep.id;
        option.text     = ep.name;
        option.selected = ep.id === activeId;
        endpointSelectEl.appendChild(option);
    }
    endpointSelectEl.addEventListener('change', async () => {
        const id = endpointSelectEl.value;
        await registry.setActiveId(id);
        await renderSettingsForm(id);
    });
}

async function renderSettingsForm(endpointId) {
    const ep       = registry.getById(endpointId);
    const settings = await registry.getSettings(endpointId);

    settingsHeading.textContent       = `${ep.name} Settings`;
    settingsFormEl.innerHTML          = '';
    filePickerArea.style.display      = 'none';
    browserStorageArea.style.display  = 'none';
    testResultEl.textContent          = '';
    testResultEl.className            = '';

    if (ep.warning) {
        endpointWarningEl.textContent    = ep.warning;
        endpointWarningEl.style.display  = 'block';
    } else {
        endpointWarningEl.style.display  = 'none';
    }

    for (const field of ep.settingsSchema) {
        const wrapper = document.createElement('div');
        wrapper.className = field.type === 'checkbox' ? 'field checkbox-field' : 'field';

        const input = document.createElement('input');
        input.type = field.type;
        input.id   = `field-${field.key}`;
        input.name = field.key;

        if (field.type === 'checkbox') {
            input.checked = settings[field.key] !== false;
        } else {
            input.value       = settings[field.key] ?? '';
            input.placeholder = field.placeholder ?? '';
        }

        const lbl = document.createElement('label');
        lbl.htmlFor     = input.id;
        lbl.textContent = field.label;

        const save = debounce(async () => {
            const current = await registry.getSettings(endpointId);
            current[field.key] = field.type === 'checkbox' ? input.checked : input.value;
            await registry.saveSettings(endpointId, current);
        }, 400);

        input.addEventListener(field.type === 'checkbox' ? 'change' : 'input', save);

        if (field.type === 'checkbox') {
            wrapper.append(input, lbl);
        } else {
            wrapper.append(lbl, input);
        }
        settingsFormEl.appendChild(wrapper);
    }

    if (endpointId === 'local_markdown') {
        filePickerArea.style.display = 'block';
        await refreshLocalMarkdownUI();
    }

    if (endpointId === 'browser_storage') {
        browserStorageArea.style.display = 'block';
        await refreshBrowserStorageUI();
    }
}

// Refresh the entire local_markdown UI: file name, permission status, queue count
async function refreshLocalMarkdownUI() {
    const ep = registry.getById('local_markdown');

    // Pre-load handle (safe to do without user gesture)
    preloadedHandle = await ep.getHandle();

    if (!preloadedHandle) {
        currentFileEl.textContent  = 'No file chosen.';
        grantStep.style.display    = 'none';
        queueStep.style.display    = 'none';
        return;
    }

    // Step 1: show filename
    currentFileEl.textContent = `✓ ${preloadedHandle.name}`;

    // Step 2: permission
    grantStep.style.display = 'block';
    const perm = await preloadedHandle.queryPermission({ mode: 'readwrite' });
    updatePermissionUI(perm);

    // Step 3: queue
    const stored = await chrome.storage.local.get('localMarkdownQueue');
    const queue  = stored['localMarkdownQueue'] ?? [];
    if (queue.length > 0) {
        queueStep.style.display  = 'block';
        queueStatusEl.textContent = `${queue.length} bookmark${queue.length === 1 ? '' : 's'} waiting to be written.`;
    } else {
        queueStep.style.display = 'none';
    }
}

function updatePermissionUI(perm) {
    if (perm === 'granted') {
        permStatusEl.textContent  = '✓ Access granted';
        permStatusEl.className    = 'perm-granted';
        grantAccessBtn.style.display = 'none';
    } else {
        permStatusEl.textContent  = 'Access needed — click Grant after each browser restart.';
        permStatusEl.className    = 'perm-needed';
        grantAccessBtn.style.display = 'inline-block';
    }
}

// Pick file — showOpenFilePicker gives readwrite permission automatically
pickFileBtn.addEventListener('click', async () => {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types:    [{ description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } }],
            multiple: false,
        });
        const ep = registry.getById('local_markdown');
        await ep.saveHandle(fileHandle);
        await refreshLocalMarkdownUI();
    } catch (e) {
        if (e.name !== 'AbortError') {
            currentFileEl.textContent = `Error: ${e.message}`;
        }
    }
});

// Grant file access — preloadedHandle is already in memory so requestPermission()
// is the first await and the user-activation requirement is satisfied
grantAccessBtn.addEventListener('click', async () => {
    if (!preloadedHandle) return;
    const perm = await preloadedHandle.requestPermission({ mode: 'readwrite' });
    updatePermissionUI(perm);
    if (perm === 'granted') {
        // Refresh queue step in case there are bookmarks waiting
        await refreshLocalMarkdownUI();
    }
});

// Flush queued bookmarks — only reachable after permission is granted
flushBtn.addEventListener('click', async () => {
    flushBtn.disabled         = true;
    queueStatusEl.textContent = 'Writing…';
    try {
        const ep     = registry.getById('local_markdown');
        const result = await ep.flushQueue();
        if (result.ok) {
            queueStep.style.display  = 'none';
            permStatusEl.textContent = `✓ Access granted — last write: ${result.message}`;
        } else {
            queueStatusEl.textContent = result.message;
        }
    } catch (e) {
        queueStatusEl.textContent = e.message;
    }
    flushBtn.disabled = false;
});

// Browser Storage UI
async function refreshBrowserStorageUI() {
    const ep   = registry.getById('browser_storage');
    const list = await ep.getAll();
    bsCountEl.textContent = `${list.length} bookmark${list.length === 1 ? '' : 's'} saved.`;
    bsExportResult.textContent = '';
}

function showExportResult(msg) {
    bsExportResult.textContent = msg;
    setTimeout(() => { bsExportResult.textContent = ''; }, 2000);
}

bsCopyMdBtn.addEventListener('click', async () => {
    const ep   = registry.getById('browser_storage');
    const list = await ep.getAll();
    await navigator.clipboard.writeText(ep.toMarkdown(list));
    showExportResult('Copied!');
});

bsCopyJsonBtn.addEventListener('click', async () => {
    const ep   = registry.getById('browser_storage');
    const list = await ep.getAll();
    await navigator.clipboard.writeText(JSON.stringify(list, null, 2));
    showExportResult('Copied!');
});

bsDownloadBtn.addEventListener('click', async () => {
    const ep      = registry.getById('browser_storage');
    const list    = await ep.getAll();
    const content = ep.toMarkdown(list);
    const url     = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
    const a       = document.createElement('a');
    a.href     = url;
    a.download = 'plainmark-bookmarks.md';
    a.click();
    showExportResult('Downloaded!');
});

bsClearBtn.addEventListener('click', async () => {
    if (!confirm('Delete all bookmarks from browser storage? This cannot be undone.')) return;
    const ep = registry.getById('browser_storage');
    await ep.clear();
    await refreshBrowserStorageUI();
});

// Test connection
testBtn.addEventListener('click', async () => {
    testResultEl.textContent = 'Testing…';
    testResultEl.className   = '';
    try {
        const ep = await registry.getActive();
        const r  = await ep.test();
        testResultEl.textContent = r.message;
        testResultEl.className   = r.ok ? 'ok' : 'error';
    } catch (e) {
        testResultEl.textContent = e.message;
        testResultEl.className   = 'error';
    }
});

init();
