import { BookmarkEndpoint } from './base.js';
import { postJson } from '../util.js';

const BASE = 'https://dynalist.io/api/v1';

export class DynalistEndpoint extends BookmarkEndpoint {
    get id()   { return 'dynalist'; }
    get name() { return 'Dynalist'; }

    get settingsSchema() {
        return [
            { key: 'token',       label: 'API Token',                          type: 'password', required: true,  placeholder: 'Get from dynalist.io/developer' },
            { key: 'useInbox',    label: 'Send to Inbox (recommended)',         type: 'checkbox', required: false },
            { key: 'fileId',      label: 'File ID (if not using inbox)',        type: 'text',     required: false, placeholder: 'File ID from Dynalist URL' },
            { key: 'inboxNodeId', label: 'Parent Node ID (if not using inbox)', type: 'text',     required: false, placeholder: 'Node ID' },
        ];
    }

    async init({ token, useInbox, fileId, inboxNodeId } = {}) {
        this._token       = token || '';
        this._useInbox    = useInbox !== false; // default true
        this._fileId      = fileId || '';
        this._inboxNodeId = inboxNodeId || '';
    }

    async add(title, url, note) {
        const content = url ? `${title} ${url}` : title;
        const noteText = note || '';

        if (this._useInbox) {
            const res = await postJson(`${BASE}/inbox/add`, {
                token:   this._token,
                content: content,
                note:    noteText,
            });
            if (res._code !== 'Ok') throw new Error(res._code);
            return { id: res.node_id };
        }

        const res = await postJson(`${BASE}/doc/edit`, {
            token:   this._token,
            file_id: this._fileId,
            changes: [{
                action:    'insert',
                parent_id: this._inboxNodeId,
                index:     -1,
                content:   content,
                note:      noteText,
                checked:   false,
            }],
        });
        if (res._code !== 'Ok') throw new Error(res._code);
        return { id: res.new_node_ids?.[0] };
    }

    async update(id, note) {
        const res = await postJson(`${BASE}/doc/edit`, {
            token:   this._token,
            file_id: this._fileId,
            changes: [{ action: 'edit', node_id: id, note: note || '' }],
        });
        if (res._code !== 'Ok') throw new Error(res._code);
        return { ok: true };
    }

    async delete(id) {
        const res = await postJson(`${BASE}/doc/edit`, {
            token:   this._token,
            file_id: this._fileId,
            changes: [{ action: 'delete', node_id: id }],
        });
        if (res._code !== 'Ok') throw new Error(res._code);
        return { ok: true };
    }

    async getFileList() {
        const res = await postJson(`${BASE}/file/list`, { token: this._token });
        if (res._code !== 'Ok') throw new Error(res._code);
        return res.files;
    }

    async getNodes(fileId) {
        const res = await postJson(`${BASE}/doc/read`, { token: this._token, file_id: fileId });
        if (res._code !== 'Ok') throw new Error(res._code);
        return res.nodes.filter(n => n.id !== 'root').map(n => ({ id: n.id, label: n.content }));
    }

    async test() {
        try {
            const res = await postJson(`${BASE}/file/list`, { token: this._token });
            if (res._code === 'Ok') {
                return { ok: true, message: `Connected. ${res.files?.length ?? 0} file(s) found.` };
            }
            return { ok: false, message: res._code };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }
}
