import { BookmarkEndpoint } from './base.js';

const BASE = 'https://beta.workflowy.com/api/v1';

export class WorkflowyEndpoint extends BookmarkEndpoint {
    get id()   { return 'workflowy'; }
    get name() { return 'Workflowy'; }

    get links() {
        return [
            { label: 'Create Account', url: 'https://workflowy.com/signup/' },
            { label: 'Get API Key',    url: 'https://beta.workflowy.com/api-key/' },
            { label: 'API Docs',       url: 'https://beta.workflowy.com/api-reference/' },
            { label: 'API Reference (Markdown)', url: 'https://beta.workflowy.com/api-reference.md' },
        ];
    }

    get addDelay() { return 500; } // ~120/min, well under rate limit

    get settingsSchema() {
        return [
            { key: 'token',    label: 'API Token (wfpak_...)', type: 'password', required: true,  placeholder: 'Get from beta.workflowy.com/api-key' },
            { key: 'parentId', label: 'Parent location',       type: 'text',     required: false, placeholder: 'inbox (default), today, or pick from list below', browse: true },
        ];
    }

    async init({ token, parentId } = {}) {
        this._token    = token || '';
        this._parentId = parentId || 'inbox';
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this._token}`,
            'Content-Type':  'application/json',
        };
    }

    async getNodes(parentId = 'None') {
        if (!this._token) return null;
        const res = await fetch(`${BASE}/nodes?parent_id=${encodeURIComponent(parentId)}`, { headers: this._headers() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.nodes || [])
            .sort((a, b) => a.priority - b.priority)
            .map(n => ({ id: n.id, label: (n.name || '').replace(/<[^>]+>/g, '') || n.id }));
    }

    async add(title, url, note) {
        const name = url ? `${title} ${url}` : title;
        const res = await fetch(`${BASE}/nodes`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({
                parent_id: this._parentId,
                name:      name,
                note:      note || '',
                position:  'bottom',
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { id: json.id };
    }

    async update(id, note) {
        const res = await fetch(`${BASE}/nodes/${id}`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({ note: note || '' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true };
    }

    async delete(id) {
        const res = await fetch(`${BASE}/nodes/${id}`, {
            method:  'DELETE',
            headers: this._headers(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { ok: true };
    }

    async test() {
        try {
            const res = await fetch(`${BASE}/targets`, { headers: this._headers() });
            if (res.ok) return { ok: true, message: 'Connected to Workflowy.' };
            return { ok: false, message: `HTTP ${res.status}` };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }
}
