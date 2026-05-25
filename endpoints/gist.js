import { BookmarkEndpoint } from './base.js';

const BASE     = 'https://api.github.com';
const FILENAME = 'bookmarks.md';
const SETTINGS_KEY = 'gistSettings';

export class GistEndpoint extends BookmarkEndpoint {
    get id()   { return 'gist'; }
    get name() { return 'GitHub Gist'; }

    get links() {
        return [
            { label: 'Create Account', url: 'https://github.com/signup' },
            { label: 'Create Token (gist scope)', url: 'https://github.com/settings/tokens/new?scopes=gist&description=Plainmark' },
            { label: 'Your Gists',    url: 'https://gist.github.com' },
        ];
    }

    get settingsSchema() {
        return [
            { key: 'token',  label: 'GitHub Token', type: 'password', required: true,  placeholder: 'ghp_...' },
            { key: 'gistId', label: 'Gist ID',      type: 'text',     required: false, placeholder: 'Leave blank — a new gist is created on first save' },
        ];
    }

    async init({ token, gistId } = {}) {
        this._token  = token  || '';
        this._gistId = gistId || '';
    }

    async add(title, url, note) {
        const content   = await this._getContent();
        const lineStart = this._lineCount(content);
        const entry     = this._formatEntry({ title, url, note });
        const updated   = (content && !content.endsWith('\n') ? content + '\n' : content) + entry + '\n';
        await this._setContent(updated);
        return { id: lineStart };
    }

    async update(lineStart, note) {
        const content = await this._getContent();
        if (!content) return { ok: true };
        const lines = content.split('\n');
        if (!lines[lineStart]?.startsWith('- ')) return { ok: true };
        if (lines[lineStart + 1]?.startsWith('  > ')) lines.splice(lineStart + 1, 1);
        if (note) lines.splice(lineStart + 1, 0, `  > ${note}`);
        await this._setContent(lines.join('\n'));
        return { ok: true };
    }

    async delete(lineStart) {
        const content = await this._getContent();
        if (!content) return { ok: true };
        const lines   = content.split('\n');
        if (!lines[lineStart]?.startsWith('- ')) return { ok: true };
        const hasNote = lines[lineStart + 1]?.startsWith('  > ');
        lines.splice(lineStart, hasNote ? 2 : 1);
        let updated = lines.join('\n');
        if (updated && !updated.endsWith('\n')) updated += '\n';
        await this._setContent(updated);
        return { ok: true };
    }

    async test() {
        try {
            const res  = await fetch(`${BASE}/user`, { headers: this._headers() });
            if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
            const user = await res.json();
            const msg  = this._gistId
                ? `Connected as ${user.login}. Gist ID: ${this._gistId}`
                : `Connected as ${user.login}. No gist ID — will create on first save.`;
            return { ok: true, message: msg };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }

    async list() {
        try {
            const content = await this._getContent();
            const lines   = content.split('\n');
            const results = [];
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].startsWith('- ')) continue;
                const raw      = lines[i].slice(2);
                const urlMatch = raw.match(/(https?:\/\/\S+)$/);
                const url      = urlMatch ? urlMatch[1] : '';
                const title    = url ? raw.slice(0, -url.length).trimEnd() : raw;
                const note     = lines[i + 1]?.startsWith('  > ') ? lines[i + 1].slice(4) : '';
                if (title) results.push({ title, url, note });
            }
            return results;
        } catch (e) {
            return null;
        }
    }

    _formatEntry({ title, url, note }) {
        const line = url ? `- ${title} ${url}` : `- ${title}`;
        return note ? `${line}\n  > ${note}` : line;
    }

    _lineCount(content) {
        if (!content) return 0;
        const n = content.split('\n').length;
        return content.endsWith('\n') ? n - 1 : n;
    }

    _headers() {
        return {
            'Authorization':        `Bearer ${this._token}`,
            'Accept':               'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    async _getContent() {
        if (!this._gistId) return '';
        const res = await fetch(`${BASE}/gists/${this._gistId}`, { headers: this._headers() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.files?.[FILENAME]?.content ?? '';
    }

    async _setContent(content) {
        if (this._gistId) {
            const res = await fetch(`${BASE}/gists/${this._gistId}`, {
                method:  'PATCH',
                headers: this._headers(),
                body:    JSON.stringify({ files: { [FILENAME]: { content } } }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return;
        }
        // No gist yet — create one and persist the new ID
        const res = await fetch(`${BASE}/gists`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({
                description: 'Plainmark bookmarks',
                public:      false,
                files:       { [FILENAME]: { content } },
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this._gistId = data.id;
        const stored  = await chrome.storage.sync.get(SETTINGS_KEY);
        const current = stored[SETTINGS_KEY] ?? {};
        current.gistId = data.id;
        await chrome.storage.sync.set({ [SETTINGS_KEY]: current });
    }
}
