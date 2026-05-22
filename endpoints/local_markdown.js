import { BookmarkEndpoint } from './base.js';

const IDB_NAME    = 'plainmark';
const IDB_VERSION = 1;
const STORE_NAME  = 'handles';
const HANDLE_KEY  = 'localMarkdown';
const QUEUE_KEY   = 'localMarkdownQueue';

// IndexedDB helpers — work in both service worker and extension page contexts
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
        const tx = db.transaction(STORE_NAME, 'readonly');
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

    // No text settings — file is picked via a button in options
    get settingsSchema() { return []; }

    async init(_settings = {}) {}

    // Called from service worker: queue the entry (can't touch the file)
    async add(title, url, note) {
        const id    = crypto.randomUUID();
        const entry = { id, title, url: url || '', note: note || '', timestamp: Date.now() };

        const stored = await chrome.storage.local.get(QUEUE_KEY);
        const queue  = stored[QUEUE_KEY] ?? [];
        queue.push(entry);
        await chrome.storage.local.set({ [QUEUE_KEY]: queue });

        return { id };
    }

    // Called from DOM context (popup or options) — flushes queue to file
    async flushQueue() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) {
            return { ok: false, message: 'No file selected. Open Options to pick a Markdown file.' };
        }

        // Check/request readwrite permission (requires prior user gesture)
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
            return { ok: false, message: 'File permission denied.' };
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

    // Update the note line of an existing entry in the file
    async update(id, note) {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: false, message: 'No file configured.' };

        await this._ensurePermission(handle);

        const file    = await handle.getFile();
        const content = await file.text();
        const updated = this._replaceNote(content, id, note);

        const writable = await handle.createWritable();
        await writable.write(updated);
        await writable.close();
        return { ok: true };
    }

    // Remove an entry from the file
    async delete(id) {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: false, message: 'No file configured.' };

        await this._ensurePermission(handle);

        const file    = await handle.getFile();
        const content = await file.text();
        const updated = this._removeEntry(content, id);

        const writable = await handle.createWritable();
        await writable.write(updated);
        await writable.close();
        return { ok: true };
    }

    // Called from options page after user picks a file
    async saveHandle(fileHandle) {
        await idbPut(HANDLE_KEY, fileHandle);
    }

    async getFileName() {
        const handle = await idbGet(HANDLE_KEY);
        return handle?.name ?? null;
    }

    async test() {
        const handle = await idbGet(HANDLE_KEY);
        if (!handle) return { ok: false, message: 'No file selected.' };
        return { ok: true, message: `File: ${handle.name}` };
    }

    _formatEntry({ id, title, url, note }) {
        let line = url
            ? `- [${title}](${url}) <!-- bm:${id} -->`
            : `- ${title} <!-- bm:${id} -->`;
        if (note) line += `\n  > ${note}`;
        return line;
    }

    _replaceNote(content, id, newNote) {
        // Match the entry line and optional existing note line
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

    async _ensurePermission(handle) {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') throw new Error('File permission denied.');
    }
}
