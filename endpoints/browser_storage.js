import { BookmarkEndpoint } from './base.js';

const STORAGE_KEY = 'browser_storage_bookmarks';

export class BrowserStorageEndpoint extends BookmarkEndpoint {
    get id()   { return 'browser_storage'; }
    get name() { return 'Browser Storage'; }

    get warning() {
        return 'Not recommended — storage is tied to this extension installation and can be cleared by Chrome or lost on reinstall.';
    }

    get settingsSchema() { return []; }

    async init() {}

    async add(title, url, note) {
        const id    = crypto.randomUUID();
        const entry = { id, title, url: url || '', note: note || '', timestamp: Date.now() };
        const list  = await this._load();
        list.push(entry);
        await this._save(list);
        return { id };
    }

    async update(id, note) {
        const list  = await this._load();
        const entry = list.find(b => b.id === id);
        if (entry) {
            entry.note = note;
            await this._save(list);
        }
        return { ok: true };
    }

    async delete(id) {
        const list = await this._load();
        await this._save(list.filter(b => b.id !== id));
        return { ok: true };
    }

    async test() {
        const list = await this._load();
        return { ok: true, message: `${list.length} bookmark(s) stored in browser storage.` };
    }

    async getAll() {
        return this._load();
    }

    async clear() {
        await this._save([]);
    }

    async list() {
        const all = await this._load();
        return all.map(({ title, url, note }) => ({ title, url: url || '', note: note || '' }));
    }

    toMarkdown(list) {
        return list.map(b => {
            const line = b.url ? `- ${b.title} ${b.url}` : `- ${b.title}`;
            return b.note ? `${line}\n  > ${b.note}` : line;
        }).join('\n') + '\n';
    }

    async _load() {
        const r = await chrome.storage.local.get(STORAGE_KEY);
        return r[STORAGE_KEY] ?? [];
    }

    async _save(list) {
        await chrome.storage.local.set({ [STORAGE_KEY]: list });
    }
}
