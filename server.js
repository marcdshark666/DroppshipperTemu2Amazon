const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5280;
// Servera alltid projektmappen, oavsett var processen startas ifrån
const ROOT = __dirname;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Lokal motsvarighet till /api/state (produktion använder Vercel Blob).
// Lagras i sync-data/ som ligger i .gitignore.
const SYNC_DIR = path.join(ROOT, 'sync-data');
const KEY_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

// Samma sammanslagning som produktionsendpointen i api/state.js
const { mergeStates } = require('./api/_merge-state.js');

function handleSyncApi(req, res, query) {
    const key = new URLSearchParams(query).get('key') || '';
    res.setHeader('Cache-Control', 'no-store');

    if (!KEY_PATTERN.test(key)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Ogiltig synknyckel.' }));
    }

    const file = path.join(SYNC_DIR, `${key}.json`);

    if (req.method === 'GET') {
        fs.readFile(file, 'utf8', (err, raw) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (err) return res.end(JSON.stringify({ ok: true, data: null, updatedAt: null }));
            try {
                const data = JSON.parse(raw);
                res.end(JSON.stringify({ ok: true, data, updatedAt: data.updatedAt || null }));
            } catch (e) {
                res.end(JSON.stringify({ ok: false, error: 'Trasig sparfil.' }));
            }
        });
        return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
        // Buffertar, inte strängkonkatenering — annars går svenska tecken
        // som delas mellan två paket sönder ("kärlkramp" -> "k??rlkramp")
        const chunks = [];
        let size = 0;
        let tooLarge = false;

        req.on('data', chunk => {
            if (tooLarge) return;
            size += chunk.length;
            if (size > 512 * 1024) {
                tooLarge = true;
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'Payload för stor.' }));
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (tooLarge) return;
            try {
                const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));

                let existing = null;
                try {
                    existing = JSON.parse(fs.readFileSync(file, 'utf8'));
                } catch (e) {
                    if (e.code !== 'ENOENT') {
                        // Filen finns men gick inte att läsa — skriv inte över den
                        res.writeHead(503, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ ok: false, error: `Kunde inte läsa befintligt tillstånd: ${e.message}` }));
                    }
                }

                const merged = mergeStates(existing, payload);
                const updatedAt = new Date().toISOString();
                fs.mkdirSync(SYNC_DIR, { recursive: true });

                // Atomisk skrivning: ett avbrott får inte lämna en halv fil
                const tmp = `${file}.tmp`;
                fs.writeFileSync(tmp, JSON.stringify({ ...merged, updatedAt }));
                fs.renameSync(tmp, file);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, updatedAt }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: String(e.message) }));
            }
        });
        return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Metoden stöds inte.' }));
}

const server = http.createServer((req, res) => {
    const [rawPath, query = ''] = req.url.split('?');
    if (decodeURIComponent(rawPath) === '/api/state') {
        return handleSyncApi(req, res, query);
    }

    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const safePath = path.normalize(urlPath).replace(/^([/\\]|\.\.)+/, '');
    let filePath = path.join(ROOT, safePath || 'index.html');
    if (urlPath === '/') filePath = path.join(ROOT, 'index.html');

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Hittades Inte</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🌐 Servern körs på: http://localhost:${PORT}`);
});
