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
const MAX_WRITE_ATTEMPTS = 4;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function isPreconditionFailure(err) {
    if (!err) return false;
    return err.name === "BlobPreconditionFailedError" ||
        /precondition|etag/i.test(String(err.message || ""));
}

function blobPath(key) {
    return `snurrhjul/${key}.json`;
}

const { mergeStates } = require("./_merge-state.js");

/* Returnerar null BARA när kontot inte finns (nytt konto).
   Vid läsfel kastas ett fel med readFailed=true — då får ingen skrivning ske,
   annars skulle en enda enhets vy radera allt som redan ligger på kontot. */
async function readExisting(blob, pathname) {
    let result;
    try {
        result = await blob.get(pathname, { access: "private", useCache: false });
    } catch (err) {
        const wrapped = new Error(`Kunde inte läsa befintligt tillstånd: ${err.message || err}`);
        wrapped.readFailed = true;
        throw wrapped;
    }

    if (!result || !result.stream) return null; // nytt konto

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
        // Trasig fil: lägg undan den i karantän i stället för att tyst skriva över
        try {
            await blob.put(`${pathname}.broken-${Date.now()}`, raw, {
                access: "private",
                contentType: "application/json",
                addRandomSuffix: false
            });
        } catch (e) { /* karantänen får misslyckas, den är en bonus */ }
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

            /* Läs–slå ihop–skriv med optimistisk låsning.
               Skrev någon annan enhet emellan läser vi om och slår ihop mot den
               nya versionen. Sista försöket görs UTAN precondition: sammanslagningen
               skyddar ändå innehållet, och att aldrig kunna spara är värre än ett
               mycket smalt konfliktfönster. */
            for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
                const sistaForsoket = attempt === MAX_WRITE_ATTEMPTS - 1;

                let existing;
                try {
                    existing = await readExisting(blob, pathname);
                } catch (err) {
                    if (err.readFailed) {
                        // Skriv ALDRIG när vi inte vet vad som redan finns
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
                    // Backa av med slumpad väntan så samtidiga skrivare inte kolliderar igen
                    await sleep(60 * Math.pow(2, attempt) + Math.floor(Math.random() * 120));
                }
            }
        }

        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ ok: false, error: "Metoden stöds inte." });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
};
