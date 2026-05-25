import { registry } from './endpoints/registry.js';

const endpointSelectEl   = document.getElementById('endpoint-select');
const endpointWarningEl  = document.getElementById('endpoint-warning');
const endpointLinksEl    = document.getElementById('endpoint-links');
const settingsFormEl     = document.getElementById('settings-form');
const settingsHeading   = document.getElementById('settings-heading');
const filePickerArea    = document.getElementById('file-picker-area');
const currentFileEl     = document.getElementById('current-file');
const pickFileBtn       = document.getElementById('pick-file-btn');
const grantStep         = document.getElementById('grant-step');
const permStatusEl      = document.getElementById('permission-status');
const grantAccessBtn    = document.getElementById('grant-access-btn');
const testBtn           = document.getElementById('test-btn');
const testResultEl      = document.getElementById('test-result');
const migrateSourceEl   = document.getElementById('migrate-source');
const migrateDestEl     = document.getElementById('migrate-dest');
const migrateBtnEl      = document.getElementById('migrate-btn');
const migrateResultEl   = document.getElementById('migrate-result');
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
    renderMigrateSelects(activeId);
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
        endpointWarningEl.textContent   = ep.warning;
        endpointWarningEl.style.display = 'block';
    } else {
        endpointWarningEl.style.display = 'none';
    }

    if (ep.links.length) {
        endpointLinksEl.innerHTML = ep.links
            .map(({ label, url }) => `<span class="ep-link-label">${label}:</span> <a href="${url}" target="_blank" rel="noopener">${url}</a>`)
            .join('<br>');
        endpointLinksEl.style.display = 'block';
    } else {
        endpointLinksEl.style.display = 'none';
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

async function refreshLocalMarkdownUI() {
    const ep = registry.getById('local_markdown');

    preloadedHandle = await ep.getHandle();

    if (!preloadedHandle) {
        currentFileEl.textContent = 'No file chosen.';
        grantStep.style.display   = 'none';
        return;
    }

    currentFileEl.textContent = `✓ ${preloadedHandle.name}`;
    grantStep.style.display   = 'block';
    const perm = await preloadedHandle.queryPermission({ mode: 'readwrite' });
    updatePermissionUI(perm);
}

function updatePermissionUI(perm) {
    if (perm === 'granted') {
        permStatusEl.textContent     = '✓ Access granted';
        permStatusEl.className       = 'perm-granted';
        grantAccessBtn.style.display = 'none';
    } else {
        permStatusEl.textContent     = 'Access needed — click Grant after each browser restart.';
        permStatusEl.className       = 'perm-needed';
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

// Migrate section
function renderMigrateSelects(activeId) {
    for (const ep of registry.getAll()) {
        const srcOpt  = document.createElement('option');
        srcOpt.value  = ep.id;
        srcOpt.text   = ep.name;
        migrateSourceEl.appendChild(srcOpt);

        const destOpt = document.createElement('option');
        destOpt.value = ep.id;
        destOpt.text  = ep.name;
        destOpt.selected = ep.id === activeId;
        migrateDestEl.appendChild(destOpt);
    }
}

migrateBtnEl.addEventListener('click', async () => {
    const sourceId = migrateSourceEl.value;
    const destId   = migrateDestEl.value;

    migrateBtnEl.disabled       = true;
    migrateResultEl.textContent = 'Reading source…';
    migrateResultEl.className   = '';

    try {
        const src   = await registry.getInitialized(sourceId);
        const items = await src.list();

        if (items === null) {
            migrateResultEl.textContent = `"${src.name}" does not support listing bookmarks.`;
            migrateResultEl.className   = 'error';
            return;
        }

        if (items.length === 0) {
            migrateResultEl.textContent = 'No bookmarks found in source.';
            return;
        }

        migrateResultEl.textContent = `Migrating ${items.length} bookmark(s)…`;
        const dest = await registry.getInitialized(destId);

        for (const { title, url, note } of items) {
            await dest.add(title, url, note);
        }

        migrateResultEl.textContent = `Migrated ${items.length} bookmark(s) to ${dest.name}.`;
        migrateResultEl.className   = 'ok';

        if (destId === 'browser_storage') await refreshBrowserStorageUI();
    } catch (e) {
        migrateResultEl.textContent = e.message;
        migrateResultEl.className   = 'error';
    } finally {
        migrateBtnEl.disabled = false;
    }
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
