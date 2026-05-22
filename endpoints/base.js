export class BookmarkEndpoint {
    get id()   { throw new Error('not implemented'); }
    get name() { throw new Error('not implemented'); }

    // Array of { key, label, type ('text'|'password'|'checkbox'), required, placeholder }
    get settingsSchema() { return []; }

    async init(settings) {}

    // Returns { id: string }
    async add(title, url, note)  { throw new Error('not implemented'); }

    // Returns { ok: true } or throws
    async update(id, note)       {}

    // Returns { ok: true } or throws
    async delete(id)             {}

    // Returns { ok: boolean, message: string }
    async test()                 { return { ok: false, message: 'not implemented' }; }
}
