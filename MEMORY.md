# Memory & Rules / Minne & Regler

## Projektet = Medicinskt Snurrhjul (2026-08-10)
Mappnamnet `Anitgravity . droppshipper` är missvisande — appen är ett medicinskt
lyckohjul. Fullständiga regler finns i `AGENTS.md`. Läs den innan du rör koden.

- **NOLLTIPS**: vänt kort = bara fallnumret. Allt annat först efter "Avslöja Diagnos".
- **Spaced repetition**: 🔴 = repetera om 10 min, 🟢 = 1 d → 3 d → ×easiness, 🔵 = nollställ.
- **Fallrad**: vertikal lista med alla 53 fallnummer, färgsätt direkt med 🟢/🔴/🔵.
- **Serversynk**: /api/state med synknyckel, kräver BLOB_READ_WRITE_TOKEN i Vercel.
- **Tidslinje**: alla träningstillfällen med tidsstämpel, grupperade per dag.
- Dev-server: `node server.js` → port 5280.
- Alla tre modellerna (Claude Code, Codex, Antigravity) läser dessa filer före ändring.

## Financial Guardrails / Ekonomiska Regler
- **Strikt regel (CRITICAL RULE)**: Du får INTE genomföra uppdrag eller åtgärder som kostar pengar utan uttryckligt godkännande.

## Modellkedja, Tvärkommunikation & Nattregler (`/goal`)
- **Modellkedja**: `Claude Code` → `Codex` → `Antigravity` (Gratisläge).
- **Tvärkommunikation mellan modeller**:
  - Alla ändringar, beslut och historik från Claude Code, Codex och Antigravity sparas och läses i de gemensamma filerna `AGENTS.md` och `MEMORY.md`.
  - Alla modeller kommunicerar och styrs via Claudes Telegram-bot.
- **Autostart**: Alla modeller och program i Windows Startup (`shell:startup`) startas **minimerade** (`WindowStyle = 7`).
- **Strikt nattregel**: Frågan via Telegram om vilket projekt som ska bearbetas under natten MÅSTE skickas **klockan 22:00**. Inget arbete får påbörjas innan denna fråga skickats kl 22:00 och bekräftats på Telegram.
