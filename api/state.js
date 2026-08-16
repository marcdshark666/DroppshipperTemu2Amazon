/* ==========================================================================
   SERVERSYNK — sparar status, repetitionsschema och tidslinje på servern
   så samma data följer med mellan datorer, mobil och plattformar.

   GET  /api/state?key=<synknyckel>   -> { ok, data, updatedAt }
   POST /api/state?key=<synknyckel>   -> { ok, updatedAt }   body = state-objektet

   Lagring:
   1. GitHub Gist (Primär - permanent, obegränsad gratis kvot utan krascher).
   2. Vercel Blob (Fallback) om BLOB_READ_WRITE_TOKEN finns.
   ========================================================================== */

const KEY_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_WRITE_ATTEMPTS = 5;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const { mergeStates } = require("./_merge-state.js");

/* GitHub Gist operations */
async function getGistStore(token, gistId) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Medicinskt-Snurrhjul-Sync",
            "Accept": "application/vnd.github+json"
        }
    });
    if (!res.ok) {
        const err = new Error(`GitHub Gist Läsfel (HTTP ${res.status})`);
        err.readFailed = true;
        throw err;
    }
    const json = await res.json();
    const file = json.files && json.files["snurrhjul_store.json"];
    const content = file ? file.content : "{}";
    try {
        return JSON.parse(content || "{}");
    } catch (e) {
        return {};
    }
}

async function updateGistStore(token, gistId, storeData) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "User-Agent": "Medicinskt-Snurrhjul-Sync",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json"
        },
        body: JSON.stringify({
            files: {
                "snurrhjul_store.json": {
                    content: JSON.stringify(storeData, null, 2)
                }
            }
        })
    });
    if (!res.ok) {
        throw new Error(`GitHub Gist Skrivfel (HTTP ${res.status})`);
    }
}

function isPreconditionFailure(err) {
    if (!err) return false;
    return err.name === "BlobPreconditionFailedError" ||
        err.name === "BlobConflictError" ||
        /precondition|etag|conflict/i.test(String(err.message || ""));
}

function blobPath(key) {
    return `snurrhjul/${key}.json`;
}

async function readExistingBlob(blob, pathname) {
    let result;
    try {
        result = await blob.get(pathname, { access: "private", useCache: false });
    } catch (err) {
        const wrapped = new Error(`Kunde inte läsa befintligt tillstånd: ${err.message || err}`);
        wrapped.readFailed = true;
        throw wrapped;
    }

    if (!result || !result.stream) return null;

    let raw;
    try {
        const chunks = [];
        for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
        raw = Buffer.concat(chunks).toString("utf8");
    } catch (err) {
        const wrapped = new Error(`Avbruten läsning av befintligt tillstånd: ${err.message || err}`);
        wrapped.readFailed = true;
        throw wrapped;
    }

    try {
        return {
            data: JSON.parse(raw),
            etag: result.blob && result.blob.etag
        };
    } catch (err) {
        return null;
    }
}

async function readBody(req) {
    if (req.body && typeof req.body === "object") return req.body;

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) throw new Error("Payload för stor");
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : null;
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    const key = (req.query && req.query.key) || "";
    if (!KEY_PATTERN.test(key)) {
        return res.status(400).json({
            ok: false,
            error: "Ogiltig synknyckel. Använd 4–64 tecken: a-z, A-Z, 0-9, _ eller -."
        });
    }

    const gistToken = (process.env.GITHUB_SYNC_TOKEN || process.env.GIST_TOKEN || "").trim();
    const gistId = (process.env.GIST_ID || "").trim();
    const hasGist = Boolean(gistToken && gistId);
    const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

    if (!hasGist && !hasBlob) {
        return res.status(503).json({
            ok: false,
            error: "Serverlagring är inte konfigurerad (Molnnyckel saknas)."
        });
    }

    try {
        // --- PRIMÄR LAGRING: GITHUB GIST (Garanterad upptid utan kvotblockering) ---
        if (hasGist) {
            if (req.method === "GET") {
                const store = await getGistStore(gistToken, gistId);
                const userData = store[key] || null;
                return res.status(200).json({
                    ok: true,
                    data: userData,
                    updatedAt: (userData && userData.updatedAt) || null
                });
            }

            if (req.method === "POST" || req.method === "PUT") {
                const payload = await readBody(req);
                if (!payload || typeof payload !== "object") {
                    return res.status(400).json({ ok: false, error: "Body måste vara ett JSON-objekt." });
                }

                for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
                    try {
                        const store = await getGistStore(gistToken, gistId);
                        const existing = store[key] || null;
                        const merged = mergeStates(existing, payload);
                        const updatedAt = new Date().toISOString();

                        store[key] = { ...merged, updatedAt };
                        await updateGistStore(gistToken, gistId, store);

                        return res.status(200).json({ ok: true, updatedAt, attempts: attempt + 1 });
                    } catch (err) {
                        if (attempt === MAX_WRITE_ATTEMPTS - 1) throw err;
                        await sleep(50 * Math.pow(2, attempt));
                    }
                }
            }
        }

        // --- SECONDARY FALLBACK: VERCEL BLOB ---
        let blob;
        try {
            blob = require("@vercel/blob");
        } catch (err) {
            return res.status(503).json({ ok: false, error: "@vercel/blob är inte installerat." });
        }

        const pathname = blobPath(key);

        if (req.method === "GET") {
            let result;
            try {
                result = await blob.get(pathname, { access: "private", useCache: false });
            } catch (err) {
                return res.status(503).json({
                    ok: false,
                    error: `Serverlagring är tillfälligt ur funktion (${err.message || err}).`
                });
            }

            if (!result || !result.stream) {
                return res.status(200).json({ ok: true, data: null, updatedAt: null });
            }

            const chunks = [];
            for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
            const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));

            return res.status(200).json({
                ok: true,
                data,
                updatedAt: data.updatedAt || null
            });
        }

        if (req.method === "POST" || req.method === "PUT") {
            const payload = await readBody(req);
            if (!payload || typeof payload !== "object") {
                return res.status(400).json({ ok: false, error: "Body måste vara ett JSON-objekt." });
            }

            for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
                const sistaForsoket = attempt === MAX_WRITE_ATTEMPTS - 1;

                let existing;
                try {
                    existing = await readExistingBlob(blob, pathname);
                } catch (err) {
                    if (err.readFailed) {
                        return res.status(503).json({ ok: false, error: err.message, retryable: true });
                    }
                    throw err;
                }

                const merged = mergeStates(existing && existing.data, payload);
                const updatedAt = new Date().toISOString();
                const body = JSON.stringify({ ...merged, updatedAt });

                const putOptions = {
                    access: "private",
                    contentType: "application/json",
                    addRandomSuffix: false,
                    allowOverwrite: true,
                    cacheControlMaxAge: 0
                };
                if (existing && existing.etag && !sistaForsoket) {
                    putOptions.ifMatch = existing.etag;
                }

                try {
                    await blob.put(pathname, body, putOptions);
                    return res.status(200).json({ ok: true, updatedAt, attempts: attempt + 1 });
                } catch (err) {
                    if (!isPreconditionFailure(err) || sistaForsoket) throw err;
                    await sleep(60 * Math.pow(2, attempt) + Math.floor(Math.random() * 120));
                }
            }
        }

        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ ok: false, error: "Metoden stöds inte." });
    } catch (err) {
        if (isPreconditionFailure(err)) {
            return res.status(409).json({
                ok: false,
                retryable: true,
                error: "En annan flik eller enhet skrev samtidigt — försök igen."
            });
        }
        if (err.readFailed || /blob|gist|forbidden|unauthorized|blocked|token/i.test(String(err.message || ""))) {
            return res.status(503).json({
                ok: false,
                error: `Serverlagring är tillfälligt ur funktion (${err.message || err}).`
            });
        }
        return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
};
