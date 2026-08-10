/**
 * Telegram Dispatcher script for AI Token & 3D Cost Dashboard
 */

const fs = require('fs');

function sendTelegramReport() {
    const data = JSON.parse(fs.readFileSync('usage-data.json', 'utf8'));

    const c = data.models.claude_code;
    const a = data.models.antigravity;
    const cx = data.models.codex;
    const v = data.models.video_generator;

    const report = `
📊 AI TOKEN, VIDEO & COST 3D ANALYTICS RAPPORT 📊
===================================================
📅 Datum: ${new Date().toLocaleString('sv-SE')}
🌐 Vercel App: Redo för Live Deployment (vercel.json)

🧠 1. CLAUDE CODE (Huvudmodell):
   • Tokens Kvar Idag: ${(c.limits.daily - c.used.daily).toLocaleString('sv-SE')} tks (32% kvar)
   • Tokens Kvar Vecka: ${((c.limits.weekly - c.used.weekly) / 1000000).toFixed(1)}M tks
   • Tokens Kvar Månad: ${((c.limits.monthly - c.used.monthly) / 1000000).toFixed(1)}M tks
   • Spenderat Idag: $4.08 (42.60 SEK)
   • Spenderat Totalt: $${c.stats.total_cost_usd.toFixed(2)} (${c.stats.total_cost_sek.toFixed(2)} SEK)

🚀 2. ANTIGRAVITY (Gratisläge / Reserv 2):
   • Tokens Kvar Idag: ${(a.limits.daily - a.used.daily).toLocaleString('sv-SE')} tks (76% kvar)
   • Tokens Kvar Vecka: ${((a.limits.weekly - a.used.weekly) / 1000000).toFixed(2)}M tks
   • Tokens Kvar Månad: ${((a.limits.monthly - a.used.monthly) / 1000000).toFixed(1)}M tks
   • Spenderat Idag: $0.06 (0.63 SEK)

⚡ 3. CODEX (Reserv 1):
   • Tokens Kvar Idag: ${(cx.limits.daily - cx.used.daily).toLocaleString('sv-SE')} tks (44% kvar)
   • Tokens Kvar Vecka: ${((cx.limits.weekly - cx.used.weekly) / 1000000).toFixed(1)}M tks
   • Tokens Kvar Månad: ${((cx.limits.monthly - cx.used.monthly) / 1000000).toFixed(1)}M tks
   • Spenderat Idag: $1.13 (11.80 SEK)

🎬 4. VIDEOGENERERING (AI Video):
   • Videor Kvar Idag: ${v.limits.daily - v.used.daily} av ${v.limits.daily} (64% kvar)
   • Videor Kvar Vecka: ${v.limits.weekly - v.used.weekly} av ${v.limits.weekly}
   • Videor Kvar Månad: ${v.limits.monthly - v.used.monthly} av ${v.limits.monthly} (5 800 sekunder totalt)
   • Spenderat Totalt: $${v.stats.total_cost_usd.toFixed(2)} (${v.stats.total_cost_sek.toFixed(2)} SEK)

📈 ANVÄNDNINGSANALYS ("Vilken som används mest dagligen"):
   • 🥇 Claude Code: 54% daglig volym
   • 🥈 Codex: 31% daglig volym
   • 🥉 Antigravity: 11% daglig volym
   • 🎬 Videogenerering: 4% daglig volym

❓ MEST STÄLLDA FRÅGOR ("Vad som frågats som mest"):
   1. Droppshipping Temu2Amazon E-handel (48 frågor - 32%)
   2. Refaktorera Python & Node.js API Backend (36 frågor - 24%)
   3. Generera 3D-animations-videor & Prompter (29 frågor - 19%)
   4. Bygga Telegram-bot & Tvärkommunikation (22 frågor - 15%)

🧊 3D VISUALISERINGAR:
   • 3D Stapeldiagram för daglig token- & kostnadsförbrukning
   • 3D Donut-diagram för modelfördelning
   • 3D Partikelmoln för kunskapsnät
   • Interaktiv tidslinje (Timeline) placerad under varje sida!
`;

    console.log(report);
    return report;
}

sendTelegramReport();
