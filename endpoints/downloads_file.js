import { BookmarkEndpoint } from './base.js';

const STORAGE_KEY = 'downloads_file_bookmarks';

export class DownloadsFileEndpoint extends BookmarkEndpoint {
    get id()   { return 'downloads_file'; }
    get name() { return 'Downloads Folder File'; }

    get settingsSchema() {
        return [
            {
                key: 'filename', label: 'Filename', type: 'text', required: false,
                placeholder: 'plainmark-bookmarks.md',
            },
        ];
    }

    async init({ filename } = {}) {
        this._filename = filename || 'plainmark-bookmarks.md';
    }

    async add(title, url, note) {
        const id      = crypto.randomUUID();
        const entry   = { id, title, url: url || '', note: note || '', timestamp: Date.now() };
        const list    = await this._load();
        list.push(entry);
        await this._save(list);
        await this._sync(list);
        return { id };
    }

    async update(id, note) {
        const list  = await this._load();
        const entry = list.find(b => b.id === id);
        if (entry) {
            entry.note = note;
            await this._save(list);
            await this._sync(list);
        }
        return { ok: true };
    }

    async delete(id) {
        const list = await this._load();
        const next = list.filter(b => b.id !== id);
        await this._save(next);
        await this._sync(next);
        return { ok: true };
    }

    async test() {
        const list = await this._load();
        return { ok: true, message: `${list.length} bookmark(s). Saves to Downloads/${this._filename}` };
    }

    async list() {
        const all = await this._load();
        return all.map(({ title, url, note }) => ({ title, url: url || '', note: note || '' }));
    }

    async _load() {
        const r = await chrome.storage.local.get(STORAGE_KEY);
        return r[STORAGE_KEY] ?? [];
    }

    async _save(list) {
        await chrome.storage.local.set({ [STORAGE_KEY]: list });
    }

    async _sync(list) {
        const content = list.map(b => this._format(b)).join('\n') + '\n';
        const url     = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
        // conflictAction:'overwrite' silently replaces the existing file
        chrome.downloads.download({
            url,
            filename:       this._filename,
            saveAs:         false,
            conflictAction: 'overwrite',
        });
    }

    _format({ title, url, note }) {
        let line = url ? `- [${title}](${url})` : `- ${title}`;
        if (note) line += `\n  > ${note}`;
        return line;
    }
}
