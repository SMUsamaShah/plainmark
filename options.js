import { registry } from './endpoints/registry.js';

const endpointRadiosEl = document.getElementById('endpoint-radios');
const settingsFormEl   = document.getElementById('settings-form');
const settingsHeading  = document.getElementById('settings-heading');
const filePickerArea   = document.getElementById('file-picker-area');
const currentFileEl    = document.getElementById('current-file');
const pickFileBtn      = document.getElementById('pick-file-btn');
const flushBtn         = document.getElementById('flush-btn');
const flushResultEl    = document.getElementById('flush-result');
const testBtn          = document.getElementById('test-btn');
const testResultEl     = document.getElementById('test-result');

let activeEndpointId = null;

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function init() {
    activeEndpointId = await registry.getActiveId();
    renderEndpointRadios();
    renderSettingsForm(activeEndpointId);
}

function renderEndpointRadios() {
    endpointRadiosEl.innerHTML = '';
    for (const ep of registry.getAll()) {
        const label = document.createElement('label');
        label.className = 'endpoint-radio' + (ep.id === activeEndpointId ? ' active' : '');

        const radio = document.createElement('input');
        radio.type    = 'radio';
        radio.name    = 'endpoint';
        radio.value   = ep.id;
        radio.checked = ep.id === activeEndpointId;

        radio.addEventListener('change', async () => {
            activeEndpointId = ep.id;
            await registry.setActiveId(ep.id);
            document.querySelectorAll('.endpoint-radio').forEach(el => el.classList.remove('active'));
            label.classList.add('active');
            renderSettingsForm(ep.id);
        });

        const nameSpan = document.createElement('span');
        nameSpan.className   = 'ep-name';
        nameSpan.textContent = ep.name;

        label.append(radio, nameSpan);
        endpointRadiosEl.appendChild(label);
    }
}

async function renderSettingsForm(endpointId) {
    const ep       = registry.getById(endpointId);
    const settings = await registry.getSettings(endpointId);

    settingsHeading.textContent = `${ep.name} Settings`;
    settingsFormEl.innerHTML    = '';
    filePickerArea.style.display = 'none';
    testResultEl.textContent     = '';
    testResultEl.className       = '';

    for (const field of ep.settingsSchema) {
        const wrapper = document.createElement('div');
        wrapper.className = field.type === 'checkbox' ? 'field checkbox-field' : 'field';

        const input = document.createElement('input');
        input.type  = field.type;
        input.id    = `field-${field.key}`;
        input.name  = field.key;

        if (field.type === 'checkbox') {
            input.checked = settings[field.key] !== false;
        } else {
            input.value       = settings[field.key] ?? '';
            input.placeholder = field.placeholder ?? '';
        }

        const lbl = document.createElement('label');
        lbl.htmlFor     = input.id;
        lbl.textContent = field.label;

        // Auto-save on change
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

    // Local markdown: show file picker UI
    if (endpointId === 'local_markdown') {
        filePickerArea.style.display = 'flex';
        const localEp = registry.getById('local_markdown');
        await localEp.init({});
        const fileName = await localEp.getFileName();
        currentFileEl.textContent = fileName
            ? `Current file: ${fileName}`
            : 'No file selected.';
    }
}

// Pick a markdown file (local_markdown endpoint only)
pickFileBtn.addEventListener('click', async () => {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'Markdown files', accept: { 'text/markdown': ['.md', '.markdown'] } }],
            multiple: false,
        });
        const localEp = registry.getById('local_markdown');
        await localEp.saveHandle(fileHandle);
        currentFileEl.textContent = `Current file: ${fileHandle.name}`;
    } catch (e) {
        if (e.name !== 'AbortError') {
            currentFileEl.textContent = `Error: ${e.message}`;
        }
    }
});

// Flush queued bookmarks
flushBtn.addEventListener('click', async () => {
    flushResultEl.textContent = 'Flushing...';
    flushResultEl.className   = '';
    try {
        const localEp = registry.getById('local_markdown');
        await localEp.init({});
        const result = await localEp.flushQueue();
        flushResultEl.textContent = result.message;
        flushResultEl.className   = result.ok ? '' : 'error';
    } catch (e) {
        flushResultEl.textContent = e.message;
        flushResultEl.className   = 'error';
    }
});

// Test connection
testBtn.addEventListener('click', async () => {
    testResultEl.textContent = 'Testing...';
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
