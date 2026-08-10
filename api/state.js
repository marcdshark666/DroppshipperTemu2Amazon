/* ==========================================================================
   SERVERSYNK — sparar status, repetitionsschema och tidslinje på servern
   så samma data följer med mellan datorer, mobil och plattformar.

   GET  /api/state?key=<synknyckel>   -> { ok, data, updatedAt }
   POST /api/state?key=<synknyckel>   -> { ok, updatedAt }   body = state-objektet

   Lagring: Vercel Blob (privat). Kräver miljövariabeln BLOB_READ_WRITE_TOKEN.
   Saknas den svarar endpointen 503 och klienten faller tillbaka på localStorage.
   ========================================================================== */

const KEY_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;
const MAX_BODY_BYTES = 512 * 1024;

function blobPath(key) {
    return `snurrhjul/${key}.json`;
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

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({
            ok: false,
            error: "Serverlagring är inte konfigurerad (BLOB_READ_WRITE_TOKEN saknas)."
        });
    }

    let blob;
    try {
        blob = require("@vercel/blob");
    } catch (err) {
        return res.status(503).json({ ok: false, error: "@vercel/blob är inte installerat." });
    }

    const pathname = blobPath(key);

    try {
        if (req.method === "GET") {
            // Privat blob — läses bara server-side med butikens token, aldrig via publik URL
            const result = await blob.get(pathname, { access: "private", useCache: false });
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

            const updatedAt = new Date().toISOString();
            const body = JSON.stringify({ ...payload, updatedAt });

            await blob.put(pathname, body, {
                access: "private",
                contentType: "application/json",
                addRandomSuffix: false,
                allowOverwrite: true,
                cacheControlMaxAge: 0
            });

            return res.status(200).json({ ok: true, updatedAt });
        }

        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ ok: false, error: "Metoden stöds inte." });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
};
