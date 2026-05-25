import { DynalistEndpoint }       from './dynalist.js';
import { WorkflowyEndpoint }      from './workflowy.js';
import { LocalMarkdownEndpoint }  from './local_markdown.js';
import { DownloadsFileEndpoint }  from './downloads_file.js';
import { BrowserStorageEndpoint } from './browser_storage.js';
import { GistEndpoint }           from './gist.js';

const ALL_ENDPOINTS = [
    new DynalistEndpoint(),
    new WorkflowyEndpoint(),
    new GistEndpoint(),
    new LocalMarkdownEndpoint(),
    new DownloadsFileEndpoint(),
    new BrowserStorageEndpoint(),
];

export const registry = {
    getAll() {
        return ALL_ENDPOINTS;
    },

    getById(id) {
        return ALL_ENDPOINTS.find(e => e.id === id) ?? ALL_ENDPOINTS[0];
    },

    async getActiveId() {
        const r = await chrome.storage.sync.get('activeEndpoint');
        return r.activeEndpoint ?? 'dynalist';
    },

    async setActiveId(id) {
        await chrome.storage.sync.set({ activeEndpoint: id });
    },

    async getActive() {
        const id      = await this.getActiveId();
        const ep      = this.getById(id);
        const key     = `${id}Settings`;
        const stored  = await chrome.storage.sync.get(key);
        await ep.init(stored[key] ?? {});
        return ep;
    },

    async getSettings(id) {
        const key    = `${id}Settings`;
        const stored = await chrome.storage.sync.get(key);
        return stored[key] ?? {};
    },

    async saveSettings(id, settings) {
        const key = `${id}Settings`;
        await chrome.storage.sync.set({ [key]: settings });
    },

    async getInitialized(id) {
        const ep       = this.getById(id);
        const settings = await this.getSettings(id);
        await ep.init(settings);
        return ep;
    },
};
