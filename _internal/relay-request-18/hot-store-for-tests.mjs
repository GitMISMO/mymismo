const S3 = new Map(); let tag = 1; globalThis.__S3 = S3;
const store = {
  async get(k) { const v = S3.get(k); return v ? { status: 200, body: v.body, etag: v.etag } : { status: 404 }; },
  async put(k, body, etag) { const v = S3.get(k); if (etag ? !v || v.etag !== etag : !!v) return { status: 409 }; const e = '"e' + (tag++) + '"'; S3.set(k, { body, etag: e }); return { status: 200, etag: e }; },
  async list(prefix, deep) { return [...S3.keys()].filter(k => k.startsWith(prefix) && (deep || !k.slice(prefix.length).includes('/'))).map(k => ({ name: k.slice(prefix.length), sha: S3.get(k).etag })); }
};
globalThis.__hotFile = (p, gh) => { if (S3.has(p)) return JSON.parse(S3.get(p).body); const pre = p.replace(/\.json$/, '/'); const ks = [...S3.keys()].filter(k => k.startsWith(pre)); if (ks.length) { const docs = {}; for (const k of ks) Object.assign(docs, (JSON.parse(S3.get(k).body).docs) || {}); return { docs }; } return gh(p); };
globalThis.__hotStore = store;
