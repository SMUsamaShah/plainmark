import { BookmarkEndpoint } from './base.js';

const IDB_NAME    = 'plainmark';
const IDB_VERSION = 1;
const STORE_NAME  = 'handles';
const HANDLE_KEY  = 'localMarkdown';
const QUEUE_KEY   = 'localMarkdownQueue';

// IndexedDB helpers — work in service worker and extension page contexts
function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess       = e => resolve(e.target.result);
        req.onerror         = e => reject(e.target.error);
    });
}

async function idbGet(key) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function idbPut(key, value) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

export class LocalMarkdownEndpoint extends BookmarkEndpoint {
    get id()   { return 'local_markdown'; }
    get name() { return 'Local Markdown File'; }

    get settingsSchema() { return []; }

    async init(_settings = {}) {}

    // Called from service worker: queue the entry (file I/O not available in SW)
    async add(title, url, note) {
        const id    = crypto.randomUUID();
        const entry = { id, title, url: url || '', note: note || '', timestamp: Date.now() };

        const stored = await chrome.storage.local.get(QUEUE_KEY);
        const queue  = stored[QUEUE_KEY] ?? [];
        queue.push(entry);
        await chrome.storage.local.set({ [QUEUE_KEY]: queue });

        return { id };
    }

    // Check current permission without requesting — safe to call anywhere, no user gesture needed
    async checkPermission() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return 'no-handle';
        return handle.queryPermission({ mode: 'readwrite' });
    }

    // Request permission — MUST be called directly from a user gesture (button click)
    async requestPermission() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return false;
        const result = await handle.requestPermission({ mode: 'readwrite' });
        return result === 'granted';
    }

    // Flush queued entries to file — only proceeds if permission already granted
    // Returns { ok, message, needsPermission? }
    async flushQueue() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) {
            return { ok: false, message: 'No file selected. Open Options to pick a Markdown file.' };
        }

        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            return { ok: false, needsPermission: true, message: 'Tap "Grant file access" to write to your Markdown file.' };
        }

        const stored = await chrome.storage.local.get(QUEUE_KEY);
        const queue  = stored[QUEUE_KEY] ?? [];
        if (queue.length === 0) return { ok: true, message: 'Nothing to flush.', count: 0 };

        const file    = await handle.getFile();
        let content   = await file.text();
        const newText = queue.map(e => this._formatEntry(e)).join('\n');
        content       = content + (content.endsWith('\n') ? '' : '\n') + newText + '\n';

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();

        await chrome.storage.local.set({ [QUEUE_KEY]: [] });
        return { ok: true, message: `Saved ${queue.length} bookmark(s) to file.`, count: queue.length };
    }

    // Update note in file — must be called from DOM context (not service worker)
    // Silently skips if no file or no permission (note update is non-critical)
    async update(id, note) {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: true }; // no file configured, skip silently

        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return { ok: true }; // permission lapsed, skip silently

        const file    = await handle.getFile();
        const content = await file.text();
        const updated = this._replaceNote(content, id, note);

        const writable = await handle.createWritable();
        await writable.write(updated);
        await writable.close();
        return { ok: true };
    }

    // Remove entry from file — must be called from DOM context (not service worker)
    async delete(id) {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: true };

        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return { ok: true };

        const file    = await handle.getFile();
        const content = await file.text();
        const updated = this._removeEntry(content, id);

        const writable = await handle.createWritable();
        await writable.write(updated);
        await writable.close();
        return { ok: true };
    }

    async saveHandle(fileHandle) {
        await idbPut(HANDLE_KEY, fileHandle);
    }

    // Exposes the raw handle for pre-loading in UI contexts so requestPermission()
    // can be called as the first await in a click handler (user gesture requirement)
    getHandle() {
        return idbGet(HANDLE_KEY);
    }

    async getFileName() {
        const handle = await idbGet(HANDLE_KEY);
        return handle?.name ?? null;
    }

    async test() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: false, message: 'No file selected.' };
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        return { ok: true, message: `File: ${handle.name} (permission: ${perm})` };
    }

    _formatEntry({ id, title, url, note }) {
        let line = url
            ? `- [${title}](${url}) <!-- bm:${id} -->`
            : `- ${title} <!-- bm:${id} -->`;
        if (note) line += `\n  > ${note}`;
        return line;
    }

    _replaceNote(content, id, newNote) {
        const entryPattern = new RegExp(
            `(- .*?<!-- bm:${id} -->)(\\n  > [^\\n]*)?`,
            'g'
        );
        return content.replace(entryPattern, (_, entryLine) => {
            return newNote ? `${entryLine}\n  > ${newNote}` : entryLine;
        });
    }

    _removeEntry(content, id) {
        const entryPattern = new RegExp(
            `- .*?<!-- bm:${id} -->(\\n  > [^\\n]*)?\n?`,
            'g'
        );
        return content.replace(entryPattern, '');
    }
}
