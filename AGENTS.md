# Project Rules / Projektregler

## Vad projektet ÄR (mappen heter fel)
Mappen heter `Anitgravity . droppshipper` men innehåller **Medicinskt Snurrhjul** —
ett lyckohjul med medicinska fall (`medical_cases.json`, 53 fall).
Filer: `index.html`, `app.js` (logik/SR/tidslinje), `wheel.js` (canvas-hjulet),
`style.css`, `server.js` (statisk dev-server, port 5280).
Kör lokalt: `node server.js` → http://localhost:5280

## 🚫 NOLLTIPS-REGELN (hård regel — ändra ALDRIG tillbaka)
När ett fall öppnas (kortet vänds) får **ENDAST fallnumret** visas.
Inga tips, ingen kategori, ingen anamnes/case-scenario, ingen mnemonic,
inga noteringar, inga länkar, ingen ledtråd av något slag.
Först när användaren trycker **"Avslöja Diagnos"** visas resten
(kategori, anamnes, diagnos, mnemonic, noteringar, länkar).
Detta gäller Claude Code, Codex OCH Antigravity/Gemini. Återinför inte
`modalScenarioText` eller `modalCategory` i öppningsläget.

## Spaced repetition (SM-2-light)
- 🔴 Ej klarad → tillbaka i kön om **10 minuter** (repeteras samma pass), easiness −0,2, lapses +1.
- 🟢 Klarad → intervall 1 dygn → 3 dygn → `intervall × easiness`, easiness +0,1 (max 2,8).
- 🔵 Nollställ → status och repetitionsschema raderas helt.
- Filterpillret **⏰ Att repetera** laddar bara fall vars `due` har passerat.
- localStorage-nycklar: `medical_wheel_statuses`, `medical_wheel_srs`,
  `medical_wheel_log`, `medical_wheel_score`, `medical_wheel_streak`.

## Serversynk
- `api/state.js` (Vercel Blob) + samma endpoint i `server.js` för lokal utveckling.
- Nyckelstyrd: `GET/POST /api/state?key=<synknyckel>`, nyckeln sparas i localStorage.
- Kräver miljövariabeln `BLOB_READ_WRITE_TOKEN` i Vercel. Saknas den svarar API:t 503
  och klienten kör vidare mot localStorage — bryt aldrig den fallbacken.
- Klienten pushar automatiskt 1,5 s efter varje ändring, hämtar vid sidladdning.

## Fallrad & tidslinje
- **Fallraden** under hjulet: horisontellt scrollbar lista med alla fallnummer.
  Tryck siffran → öppnar fallet (nolltips gäller). Prickarna 🟢/🔴/🔵 sätter status direkt.
- **Tidslinjen** i högerpanelen: varje träningstillfälle sparas med tidsstämpel,
  grupperat per dag, med nästa repetitionstillfälle. Max 300 poster.

## Economy & Financial Guardrails / Ekonomiska Regler
- **CRITICAL RULE**: Du får INTE genomföra uppdrag eller åtgärder som kostar pengar utan uttryckligt godkännande i förväg.
- **CRITICAL RULE**: You are NOT allowed to execute tasks or actions that cost money without explicitly asking the user and obtaining confirmation first.

## Model Fallback & Nattarbete Protocol / Modellkedja & Nattregler
- **Modellkedja vid tokenbrist**:
  1. **Claude Code** (Huvudmodell)
  2. **Codex** (Reservmodell 1 — avbytarmodell när Claude Code saknar credits/tokens)
  3. **Antigravity / Gratisläge** (Reservmodell 2 — avbytarmodell när Codex saknar credits/tokens)
- **Telegram-styre & Tvärkommunikation**:
  - Alla modeller (Claude Code, Codex, Antigravity) ska kommunicera, dela historik och kunna styras via Telegram (Claudes Telegram-bot).
  - Alla ändringar, beslut och framsteg skrivs ner i `AGENTS.md` och `MEMORY.md` så att ingenting glöms bort eller missas mellan modellerna.
- **Windows Startup (`shell:startup`)**:
  - Claude Code, Codex och Antigravity startas automatiskt vid Windows autostart.
  - Alla genvägar/program i `shell:startup` startas **minimerade** (`WindowStyle = 7`).
- **STRIKT REGEL FÖR GRATISLÄGE / NATTARBETE (`/goal`)**:
  - Frågan på Telegram om vilket projekt som ska bearbetas under natten ska **ALLTID ställas klockan 22:00**.
  - **FÖRBUD**: Du får **INTE** börja arbeta med detta förrän du har ställt denna fråga på Telegram vid kl. 22:00.
