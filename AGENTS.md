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

## Fyra svårighetsgrader + spaced repetition (SM-2-light)
- 🟢 Klarade lätt → +10 p, 1 d → 3 d → `intervall × easiness`, easiness +0,1 (max 2,8).
- 🟡 Lite svårt → +7 p, 1 d → `× 1,6`, easiness −0,05. Räknas som klarad, ökar streaken.
- 🟠 På gränsen → +3 p, tillbaka om **8 timmar**, easiness −0,15. Bryter inte streaken men ökar den inte.
- 🔴 Klarade inte → 0 p, tillbaka om **10 minuter**, easiness −0,2, lapses +1. Nollställer streaken.
- 🔵 Nollställ → status och repetitionsschema raderas helt.
- Filterpillret **⏰ Att repetera** laddar bara fall vars `due` har passerat.
- localStorage-nycklar: `medical_wheel_statuses`, `medical_wheel_srs`,
  `medical_wheel_log`, `medical_wheel_score`, `medical_wheel_streak`.

## Konto & serversynk
- Inloggning med **e-post utan lösenord**. Kontonyckeln är `u` + SHA-256(`snurrhjul:<e-post>`)
  trunkerad till 40 tecken. E-postadressen skickas aldrig till servern.
- `api/state.js` (Vercel Blob, store `snurrhjul-data`, **access: private**)
  + samma endpoint i `server.js` för lokal utveckling (`sync-data/`).
- `GET/POST /api/state?key=<kontonyckel>`. Utan giltig token svarar API:t 503
  och klienten kör vidare mot localStorage — bryt aldrig den fallbacken.
- Sparas **direkt vid knapptryck** (250 ms ihopslagning) + sendBeacon innan fliken stängs.

### Regler som INTE får brytas i synken
1. `readExisting` får returnera `null` **bara** när kontot inte finns. Vid läsfel: kasta
   med `readFailed=true` → 503. Skriv aldrig när du inte vet vad som redan ligger där —
   `mergeStates(null, x)` returnerar `x` och raderar alltså hela kontot.
2. `pushState` får aldrig returnera tyst vid pågående skrivning — köa med `pushQueued`.
   `stateRev`/`ackedRev` avgör vad som är kvitterat, inte `pendingSave` ensamt.
3. Grön "sparat"-banner kräver `serverSeenAt !== null`, dvs. ett faktiskt serversvar.
4. `logout()` måste flusha osparat och sedan köra `resetStudyState()` — annars ärver
   nästa konto föregående användares färger och laddar upp dem som sina egna.
5. Filer under `api/` som inte är endpoints ska ha `_`-prefix, annars bygger Vercel dem
   till egna trasiga funktioner.

## ⚠️ Vercel-koppling (rör inte)
Detta repo deployar till projektet **medicinskt-snurrhjul** och inget annat.
`ada-zdrowa` var tidigare kopplat till samma repo och blev överskrivet vid varje push —
kopplingen togs bort 2026-08-10. Ada har nu egen mapp `E:\CHAT-RTX\ada-zdrowa`
med eget git-repo. Koppla ALDRIG in fler projekt mot det här repot.

## Fallrad, sök, statistik & tidslinje
- **Fallraden** under hjulet: vertikal lista med alla fallnummer.
  Tryck siffran → öppnar fallet (nolltips gäller). Prickarna 🟢/🟡/🟠/🔴/🔵 sätter status direkt.
- **Sökfältet** filtrerar på fallnummer och tar BARA siffror — sök aldrig i `title`,
  det skulle avslöja diagnosen och bryta nolltips-regeln.
- **Cirkeldiagrammet** i högerpanelen ritas som ren SVG i `renderStats()` (strikt CSP,
  inga externa bibliotek). Teckenförklaringen klickar på motsvarande statusfilter.
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
