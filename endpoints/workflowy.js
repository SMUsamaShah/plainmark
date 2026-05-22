import { BookmarkEndpoint } from './base.js';

const BASE = 'https://beta.workflowy.com/api/v1';

export class WorkflowyEndpoint extends BookmarkEndpoint {
    get id()   { return 'workflowy'; }
    get name() { return 'Workflowy'; }

    get settingsSchema() {
        return [
            { key: 'token',    label: 'API Token (wfpak_...)', type: 'password', required: true,  placeholder: 'Get from beta.workflowy.com/api-key' },
            { key: 'parentId', label: 'Parent location',       type: 'text',     required: false, placeholder: 'inbox (default), today, or a node UUID' },
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

    async add(title, url, note) {
        // Use markdown link syntax in the name field
        const name = url ? `[${title}](${url})` : title;
        const res = await fetch(`${BASE}/nodes`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({
                parent_id: this._parentId,
                name:      name,
                note:      note || '',
                position:  0,
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
