export class BookmarkEndpoint {
    get id()   { throw new Error('not implemented'); }
    get name() { throw new Error('not implemented'); }

    // Optional warning shown in the options page below the endpoint selector
    get warning() { return null; }

    // Optional array of { label, url } links shown below the endpoint selector
    get links() { return []; }

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

    // Returns null if listing is not supported, or [{title, url, note}] if it is
    async list()                 { return null; }

    // Returns null if not supported, or [{id, label}] for the node picker
    async getNodes()             { return null; }
}
