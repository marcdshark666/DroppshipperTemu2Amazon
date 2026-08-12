/* ==========================================================================
   MEDICINSKT SNURRHJUL — APPLICATION LOGIC (app.js)
   ========================================================================== */

let wheel = null;
let allMedicalCases = [];
let caseStatuses = JSON.parse(localStorage.getItem("medical_wheel_statuses") || "{}");
let userScore = parseInt(localStorage.getItem("medical_wheel_score") || "0");
let userStreak = parseInt(localStorage.getItem("medical_wheel_streak") || "0");
let srsData = JSON.parse(localStorage.getItem("medical_wheel_srs") || "{}");
let trainingLog = JSON.parse(localStorage.getItem("medical_wheel_log") || "[]");
// Tidsstämpel per fall — avgör vilken sida som vinner när server och webbläsare skiljer sig
let statusUpdatedAt = JSON.parse(localStorage.getItem("medical_wheel_status_at") || "{}");
let currentSelectedCase = null;
let selectedCategories = new Set();
let activeStatusFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
    wheel = new MedicalWheel("wheelCanvas");
    loadMedicalCases();
    initEventListeners();
    updateScoreUI();
    renderTimeline();
    initSync();
});

/* ==========================================================================
   SERVERSYNK — samma data på dator och mobil via /api/state
   Nyckeln sparas lokalt; utan nyckel körs allt precis som förut (localStorage).
   ========================================================================== */
let accountEmail = localStorage.getItem("medical_wheel_email") || "";
let syncKey = localStorage.getItem("medical_wheel_synckey") || "";
let syncTimer = null;

/* Kontonyckeln härleds ur e-posten — samma e-post ger alltid samma konto,
   på vilken dator eller telefon som helst. Adressen skickas aldrig till servern. */
async function keyFromEmail(email) {
    const normalized = String(email).trim().toLowerCase();
    const bytes = new TextEncoder().encode(`snurrhjul:${normalized}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    return `u${hex.slice(0, 40)}`;
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
}

function renderAccountUI() {
    const loginBox = document.getElementById("loginBox");
    const accountBox = document.getElementById("accountBox");
    const label = document.getElementById("accountLabel");
    if (!loginBox || !accountBox) return;

    if (accountEmail && syncKey) {
        loginBox.style.display = "none";
        accountBox.style.display = "block";
        if (label) label.innerText = accountEmail;
    } else {
        loginBox.style.display = "block";
        accountBox.style.display = "none";
    }
}

function setSyncState(text, kind) {
    const el = document.getElementById("syncState");
    if (!el) return;
    el.innerText = text;
    el.className = `sync-state ${kind || ""}`;
}

/* Bannern högst upp i hjulpanelen talar alltid om var dina val hamnar.
   Den går inte att missa — det var precis felet förut. */
function renderSaveBanner() {
    const el = document.getElementById("saveBanner");
    if (!el) return;

    if (!syncKey) {
        el.className = "save-banner warn";
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
            <span>Du är <strong>inte inloggad</strong> — dina 🟢/🔴/🔵 sparas bara i den här webbläsaren.</span>
            <button class="banner-btn" id="bannerLogin">Logga in med e-post</button>`;
        el.querySelector("#bannerLogin")?.addEventListener("click", focusLogin);
        return;
    }

    if (hasUnsaved()) {
        el.className = "save-banner pending";
        el.innerHTML = `<i class="fa-solid fa-cloud-arrow-up fa-fade"></i>
            <span>Sparar dina val till <strong>${accountEmail}</strong>...</span>`;
        return;
    }

    // Grön bock kräver att servern faktiskt har svarat — inte bara att en nyckel finns
    if (serverSeenAt === null) {
        el.className = "save-banner pending";
        el.innerHTML = `<i class="fa-solid fa-cloud-arrow-down fa-fade"></i>
            <span>Kontrollerar servern för <strong>${accountEmail}</strong>...</span>`;
        return;
    }

    const kl = new Date(serverSeenAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    el.className = "save-banner ok";
    el.innerHTML = `<i class="fa-solid fa-circle-check"></i>
        <span>Alla val sparade på servern för <strong>${accountEmail}</strong> (kvitterat ${kl})</span>`;
}

function focusLogin() {
    const input = document.getElementById("accountEmail");
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus();
    input.classList.add("highlight");
    setTimeout(() => input.classList.remove("highlight"), 2000);
}

function collectState() {
    return {
        statuses: caseStatuses,
        statusUpdatedAt: statusUpdatedAt,
        srs: srsData,
        log: trainingLog,
        score: userScore,
        streak: userStreak
    };
}

function saveLocal() {
    localStorage.setItem("medical_wheel_statuses", JSON.stringify(caseStatuses));
    localStorage.setItem("medical_wheel_status_at", JSON.stringify(statusUpdatedAt));
    localStorage.setItem("medical_wheel_srs", JSON.stringify(srsData));
    localStorage.setItem("medical_wheel_log", JSON.stringify(trainingLog));
    localStorage.setItem("medical_wheel_score", String(userScore));
    localStorage.setItem("medical_wheel_streak", String(userStreak));
}

function stamp(id) {
    statusUpdatedAt[id] = new Date().toISOString();
}

function timeOf(map, id) {
    const v = map && map[id];
    return v ? new Date(v).getTime() : 0;
}

/* Slår ihop serverns tillstånd med det som redan finns i webbläsaren.
   Per fall vinner den senaste ändringen — ett val du nyss gjort skrivs
   ALDRIG över av en äldre serverkopia. */
function mergeState(remote) {
    if (!remote || typeof remote !== "object") return false;

    const remoteStatuses = remote.statuses || {};
    const remoteAt = remote.statusUpdatedAt || {};
    const remoteSrs = remote.srs || {};

    const ids = new Set([...Object.keys(caseStatuses), ...Object.keys(remoteStatuses), ...Object.keys(remoteAt)]);

    ids.forEach(id => {
        const localTime = timeOf(statusUpdatedAt, id);
        const remoteTime = timeOf(remoteAt, id);

        // Okänd ålder på båda sidor: låt servern fylla i det som saknas lokalt
        const remoteWins = remoteTime > localTime || (remoteTime === 0 && localTime === 0 && !(id in caseStatuses));

        if (!remoteWins) return;

        if (remoteStatuses[id]) {
            caseStatuses[id] = remoteStatuses[id];
        } else {
            delete caseStatuses[id];
        }
        if (remoteSrs[id]) srsData[id] = remoteSrs[id];
        else delete srsData[id];

        if (remoteAt[id]) statusUpdatedAt[id] = remoteAt[id];
    });

    // Tidslinjen slås ihop och dedupliceras på fall + tidpunkt
    const seen = new Set();
    const merged = [...(Array.isArray(remote.log) ? remote.log : []), ...trainingLog]
        .filter(e => {
            if (!e || !e.at) return false;
            const k = `${e.id}|${e.at}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 300);
    trainingLog = merged;

    // Poäng kan bara växa — ta aldrig bort intjänade poäng vid en sammanslagning
    userScore = Math.max(userScore, parseInt(remote.score || 0, 10) || 0);
    userStreak = trainingLog.length && trainingLog[0].passed
        ? Math.max(userStreak, parseInt(remote.streak || 0, 10) || 0)
        : userStreak;

    saveLocal();
    updateScoreUI();
    applyFilters();
    renderTimeline();
    return true;
}

/* pendingSave överlever en omladdning: en ändring som inte nått servern
   glöms aldrig bort, utan skickas om vid nästa tillfälle. */
let pendingSave = localStorage.getItem("medical_wheel_pending") === "1";
let pushInFlight = false;
let pushQueued = false;
let pushFailures = 0;
/* stateRev räknas upp vid varje ändring, ackedRev vid varje kvitterad skrivning.
   Skiljer de sig finns osparat arbete — även om en skrivning nyss lyckades. */
let stateRev = 0;
let ackedRev = 0;
/* Sätts bara när servern faktiskt har svarat. Persisteras aldrig. */
let serverSeenAt = null;

function hasUnsaved() {
    return pendingSave || stateRev !== ackedRev;
}

function setPending(value) {
    pendingSave = value;
    localStorage.setItem("medical_wheel_pending", value ? "1" : "0");
    renderSaveBanner();
}

async function pushState(silent) {
    if (!syncKey) return;
    // En skrivning pågår: köa i stället för att tyst kasta bort den nya ändringen
    if (pushInFlight) { pushQueued = true; return; }

    pushInFlight = true;
    const revAtSend = stateRev;
    const keyAtSend = syncKey;
    if (!silent) setSyncState("Sparar till servern...", "working");

    try {
        const res = await fetch(`/api/state?key=${encodeURIComponent(keyAtSend)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectState())
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
            const fel = new Error(json.error || `HTTP ${res.status}`);
            // Servern säger själv om det är värt att försöka igen (t.ex. krock mellan flikar)
            fel.retryable = json.retryable === true || res.status === 409 || res.status === 503;
            throw fel;
        }

        serverSeenAt = Date.now();
        ackedRev = revAtSend;
        pushFailures = 0;
        // Ändringar som gjorts EFTER avsändningen är fortfarande osparade
        setPending(stateRev !== revAtSend);
        setSyncState(`✓ Sparat på servern ${new Date().toLocaleTimeString("sv-SE")}`, "ok");
    } catch (err) {
        pushFailures++;
        setPending(true);

        // Övergående krock: säg inte att det gick fel, det löser sig av sig självt
        const overgaende = (err.retryable || /precondition|etag/i.test(err.message)) && pushFailures < 4;
        if (overgaende) {
            setSyncState("Sparar... (en annan flik skrev samtidigt, försöker igen)", "working");
            setTimeout(() => { if (hasUnsaved() && syncKey) pushState(true); },
                300 + Math.floor(Math.random() * 400));
        } else {
            setSyncState(`Inte sparat på servern än (${err.message}) — försöker igen.`, "error");
        }
    } finally {
        pushInFlight = false;
        if (pushQueued || stateRev !== ackedRev) {
            pushQueued = false;
            if (syncKey) setTimeout(() => pushState(true), 0);
        }
    }
}

/* Sparar direkt när du trycker på en knapp — ingen fördröjning.
   Snabba klick i följd slås ihop till en skrivning via syncTimer. */
function queuePush() {
    stateRev++;
    setPending(true);

    if (!syncKey) {
        setSyncState("Sparat i den här webbläsaren. Logga in för att spara på servern.", "error");
        return;
    }

    clearTimeout(syncTimer);
    setSyncState("Sparar...", "working");
    const keyAtQueue = syncKey;
    syncTimer = setTimeout(() => {
        syncTimer = null;
        // Har kontot bytts under fördröjningen får skrivningen inte gå till fel konto
        if (syncKey === keyAtQueue) pushState(true);
    }, 250);
}

/* Skickar om det som ligger osparat: när nätet kommer tillbaka,
   när fliken blir aktiv igen och var 20:e sekund. */
function startRetryLoop() {
    const retry = () => {
        if (hasUnsaved() && syncKey && navigator.onLine !== false) pushState(true);
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") retry();
    });
    // Slumpad takt så två öppna flikar inte skriver i samma ögonblick varje gång
    setInterval(retry, 20000 + Math.floor(Math.random() * 8000));
}

async function pullState(silent) {
    if (!syncKey) return;
    if (!silent) setSyncState("Hämtar från servern...", "working");

    try {
        const res = await fetch(`/api/state?key=${encodeURIComponent(syncKey)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

        serverSeenAt = Date.now();

        if (!json.data) {
            // Tomt konto och inget lokalt att bidra med — ladda inte upp tomhet
            if (!Object.keys(caseStatuses).length && !trainingLog.length) {
                setPending(false);
                ackedRev = stateRev;
                setSyncState("Nytt konto — inget att ladda upp än.", "ok");
                renderSaveBanner();
                return;
            }
            setSyncState("Nytt konto — dina fall här laddas upp till servern.", "ok");
            setPending(true);
            pushState(true);
            return;
        }

        serverSeenAt = Date.now();
        mergeState(json.data);
        const antalFall = Object.keys(caseStatuses).length;
        setSyncState(`✓ Inloggad. ${antalFall} färgsatta fall, ${trainingLog.length} träningstillfällen.`, "ok");
        renderSaveBanner();

        // Sammanslagningen kan ha gett servern nytt att spara
        if (hasUnsaved()) pushState(true);
    } catch (err) {
        setSyncState(`Kunde inte hämta från servern (${err.message}). Kör vidare lokalt.`, "error");
        const el = document.getElementById("saveBanner");
        if (el && syncKey) {
            el.className = "save-banner warn";
            el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
                <span>Ingen kontakt med servern — dina val ligger bara i den här webbläsaren just nu.</span>`;
        }
    }
}

const LOCAL_KEYS = [
    "medical_wheel_statuses", "medical_wheel_status_at", "medical_wheel_srs",
    "medical_wheel_log", "medical_wheel_score", "medical_wheel_streak", "medical_wheel_pending"
];

/* Tömmer all studiedata ur både minnet och webbläsaren.
   Utan detta ärver nästa konto föregående användares färger. */
function resetStudyState() {
    caseStatuses = {};
    statusUpdatedAt = {};
    srsData = {};
    trainingLog = [];
    userScore = 0;
    userStreak = 0;
    pendingSave = false;
    stateRev = 0;
    ackedRev = 0;
    LOCAL_KEYS.forEach(k => localStorage.removeItem(k));

    updateScoreUI();
    applyFilters();
    renderTimeline();
    renderSaveBanner();
}

async function loginWithEmail(email) {
    if (!isValidEmail(email)) {
        setSyncState("Skriv en giltig e-postadress.", "error");
        return;
    }

    setSyncState("Loggar in...", "working");
    const normalized = String(email).trim().toLowerCase();
    const newKey = await keyFromEmail(normalized);
    const lastKey = localStorage.getItem("medical_wheel_lastkey") || "";
    const antalLokala = Object.keys(caseStatuses).length;

    if (lastKey && lastKey !== newKey) {
        // Byte till ett annat konto — ärv aldrig föregående användares data
        resetStudyState();
    } else if (!lastKey && (antalLokala || trainingLog.length)) {
        const svar = confirm(
            `Du har ${antalLokala} färgsatta fall i den här webbläsaren.\n\n` +
            `Vill du ta med dem till kontot ${normalized}?`
        );
        if (!svar) resetStudyState();
    }

    accountEmail = normalized;
    syncKey = newKey;
    serverSeenAt = null;
    localStorage.setItem("medical_wheel_email", accountEmail);
    localStorage.setItem("medical_wheel_synckey", syncKey);
    localStorage.setItem("medical_wheel_lastkey", syncKey);

    renderAccountUI();
    renderSaveBanner();
    await pullState(false);
}

async function logout() {
    // Stoppa den köade skrivningen så den inte fyras av mot fel konto
    clearTimeout(syncTimer);
    syncTimer = null;

    // Spara det som ligger osparat innan kontot lämnas
    if (hasUnsaved() && syncKey) await pushState(false);

    accountEmail = "";
    syncKey = "";
    serverSeenAt = null;
    localStorage.removeItem("medical_wheel_email");
    localStorage.removeItem("medical_wheel_synckey");
    localStorage.removeItem("medical_wheel_lastkey");

    resetStudyState();

    const input = document.getElementById("accountEmail");
    if (input) { input.value = ""; input.blur(); }

    renderAccountUI();
    renderSaveBanner();
    setSyncState("Utloggad — ingen studiedata ligger kvar i den här webbläsaren.", "");
}

function initSync() {
    const input = document.getElementById("accountEmail");
    if (input) input.value = accountEmail;

    document.getElementById("btnLogin")?.addEventListener("click", () => loginWithEmail(input?.value || ""));
    input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") loginWithEmail(input.value);
    });

    document.getElementById("btnLogout")?.addEventListener("click", logout);
    document.getElementById("btnSyncPull")?.addEventListener("click", () => {
        if (!syncKey) return setSyncState("Logga in först.", "error");
        pullState(false);
    });

    renderAccountUI();
    renderSaveBanner();

    if (syncKey) {
        pullState(true);
    }

    startRetryLoop();

    // Sista utvägen: skicka allt osparat innan fliken stängs
    window.addEventListener("beforeunload", () => {
        if (!syncKey || !hasUnsaved()) return;
        clearTimeout(syncTimer);
        syncTimer = null;
        navigator.sendBeacon?.(
            `/api/state?key=${encodeURIComponent(syncKey)}`,
            new Blob([JSON.stringify(collectState())], { type: "application/json" })
        );
    });
}

/* ==========================================================================
   SPACED REPETITION (SM-2-light)
   Rött = lapse → tillbaka i kön om 10 minuter (repeteras samma pass).
   Grönt = intervallet växer: 1 dygn → 3 dygn → intervall × easiness.
   ========================================================================== */
const LAPSE_MINUTES = 10;

function getSrs(id) {
    return srsData[id] || { reps: 0, intervalDays: 0, easiness: 2.5, lapses: 0, due: null, last: null };
}

function scheduleCase(id, passed) {
    const s = getSrs(id);
    const now = Date.now();
    let dueMs;

    if (passed) {
        s.reps += 1;
        s.easiness = Math.min(2.8, s.easiness + 0.1);
        if (s.reps === 1) s.intervalDays = 1;
        else if (s.reps === 2) s.intervalDays = 3;
        else s.intervalDays = Math.round(s.intervalDays * s.easiness);
        dueMs = now + s.intervalDays * 24 * 60 * 60 * 1000;
    } else {
        s.reps = 0;
        s.lapses += 1;
        s.intervalDays = 0;
        s.easiness = Math.max(1.3, s.easiness - 0.2);
        dueMs = now + LAPSE_MINUTES * 60 * 1000;
    }

    s.last = new Date(now).toISOString();
    s.due = new Date(dueMs).toISOString();
    srsData[id] = s;
    localStorage.setItem("medical_wheel_srs", JSON.stringify(srsData));
    return s;
}

function isDue(id) {
    const s = srsData[id];
    if (!s || !s.due) return false;
    return new Date(s.due).getTime() <= Date.now();
}

function formatRelative(iso) {
    if (!iso) return "";
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    const min = Math.round(abs / 60000);
    const hrs = Math.round(abs / 3600000);
    const days = Math.round(abs / 86400000);
    let text;
    if (min < 60) text = `${min} min`;
    else if (hrs < 24) text = `${hrs} h`;
    else text = `${days} d`;
    return diff >= 0 ? `om ${text}` : `${text} sedan`;
}

function formatStamp(iso) {
    const d = new Date(iso);
    return d.toLocaleString("sv-SE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function updateScoreUI() {
    document.getElementById("scoreDisplay").innerText = `${userScore} p`;
    document.getElementById("streakDisplay").innerText = `${userStreak} streak`;
}

function loadMedicalCases() {
    const syncStatus = document.getElementById("syncStatus");
    if (syncStatus) syncStatus.innerText = "Laddar fall...";

    fetch("medical_cases.json")
        .then(res => res.json())
        .then(data => {
            allMedicalCases = data;
            if (syncStatus) syncStatus.innerText = `${data.length} Fall Klara`;
            buildCategoryFilters();
            applyFilters();
        })
        .catch(err => {
            console.error("Kunde inte ladda medical_cases.json:", err);
            if (syncStatus) syncStatus.innerText = "Fel vid laddning";
        });
}

function buildCategoryFilters() {
    const container = document.getElementById("categoryContainer");
    if (!container) return;

    const categories = Array.from(new Set(allMedicalCases.map(c => c.category || "Övrigt")));
    container.innerHTML = "";

    categories.forEach(cat => {
        const label = document.createElement("label");
        label.className = "checkbox-label";
        label.innerHTML = `
            <input type="checkbox" value="${cat}" checked onchange="toggleCategory('${cat}', this.checked)">
            <span>${cat}</span>
        `;
        container.appendChild(label);
        selectedCategories.add(cat);
    });
}

function toggleCategory(category, isChecked) {
    if (isChecked) {
        selectedCategories.add(category);
    } else {
        selectedCategories.delete(category);
    }
    applyFilters();
}

function initEventListeners() {
    // Show titles toggle
    document.getElementById("toggleShowTitles")?.addEventListener("change", (e) => {
        if (wheel) wheel.setShowTitles(e.target.checked);
    });

    // Red C filter checkbox
    document.getElementById("chkRedCOnly")?.addEventListener("change", () => {
        applyFilters();
    });

    // Status filter pills
    document.querySelectorAll(".pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeStatusFilter = btn.getAttribute("data-status");
            applyFilters();
        });
    });

    // Spin button
    document.getElementById("btnSpin")?.addEventListener("click", () => {
        if (!wheel || wheel.isSpinning) return;
        wheel.spin((winningCase) => {
            openMysteryModal(winningCase);
        });
    });

    // Reveal Diagnosis button
    document.getElementById("btnRevealDiagnosis")?.addEventListener("click", () => {
        revealDiagnosis();
    });

    // Pass / Fail buttons
    document.getElementById("btnMarkPass")?.addEventListener("click", () => markCaseResult(true));
    document.getElementById("btnMarkFail")?.addEventListener("click", () => markCaseResult(false));

    // Close Modal buttons
    document.getElementById("btnCloseMystery")?.addEventListener("click", closeMysteryModal);

    // Rensa tidslinjen (behåller status och repetitionsschema)
    document.getElementById("btnClearHistory")?.addEventListener("click", () => {
        if (!trainingLog.length) return;
        if (!confirm("Rensa hela träningstidslinjen? Statusfärger och repetitionsschema behålls.")) return;
        trainingLog = [];
        localStorage.setItem("medical_wheel_log", "[]");
        renderTimeline();
        queuePush();
    });
}

function applyFilters() {
    const redCOnly = document.getElementById("chkRedCOnly")?.checked;

    let filtered = allMedicalCases.filter(item => {
        // Category check
        const cat = item.category || "Övrigt";
        if (!selectedCategories.has(cat)) return false;

        // Red C check
        if (redCOnly && !item.hasRedC) return false;

        // Status check
        const status = caseStatuses[item.id] || "untested"; // green, red, untested
        if (activeStatusFilter === "green" && status !== "green") return false;
        if (activeStatusFilter === "red" && status !== "red") return false;
        if (activeStatusFilter === "untested" && status !== "untested") return false;
        if (activeStatusFilter === "due" && !isDue(item.id)) return false;

        return true;
    });

    // Update Counts
    let greenCount = 0, redCount = 0, untestedCount = 0;
    allMedicalCases.forEach(c => {
        const st = caseStatuses[c.id] || "untested";
        if (st === "green") greenCount++;
        else if (st === "red") redCount++;
        else untestedCount++;
    });

    document.getElementById("countAll").innerText = allMedicalCases.length;
    document.getElementById("countGreen").innerText = greenCount;
    document.getElementById("countRed").innerText = redCount;
    document.getElementById("countUntested").innerText = untestedCount;
    document.getElementById("countDue").innerText = allMedicalCases.filter(c => isDue(c.id)).length;
    document.getElementById("activeCasesCount").innerText = filtered.length;

    if (wheel) {
        wheel.setItems(filtered);
    }

    renderCaseStrip();
}

/* ==========================================================================
   FALLRAD — scrolla igenom alla fall och sätt 🟢 / 🔴 / 🔵 direkt
   ========================================================================== */
function renderCaseStrip() {
    const strip = document.getElementById("caseStrip");
    if (!strip) return;

    strip.innerHTML = "";
    allMedicalCases.forEach(c => {
        const status = caseStatuses[c.id] || "untested";
        const num = c.number || c.rowIndex;
        const chip = document.createElement("div");
        chip.className = `case-chip status-${status}${isDue(c.id) ? " is-due" : ""}`;
        chip.innerHTML = `
            <button class="chip-number" title="Öppna fall #${num}">#${num}</button>
            <div class="chip-actions">
                <button class="chip-dot dot-green" data-set="green" title="Klarade">🟢</button>
                <button class="chip-dot dot-red" data-set="red" title="Ej klarade — repetera senare">🔴</button>
                <button class="chip-dot dot-blue" data-set="untested" title="Nollställ till ej testad">🔵</button>
            </div>
        `;
        chip.querySelector(".chip-number").addEventListener("click", () => openMysteryModal(c));
        chip.querySelectorAll(".chip-dot").forEach(btn => {
            btn.addEventListener("click", () => setCaseStatus(c, btn.getAttribute("data-set")));
        });
        strip.appendChild(chip);
    });
}

function setCaseStatus(caseData, newStatus) {
    if (newStatus === "untested") {
        delete caseStatuses[caseData.id];
        delete srsData[caseData.id];
    } else {
        caseStatuses[caseData.id] = newStatus;
        const s = scheduleCase(caseData.id, newStatus === "green");
        logTraining(caseData, newStatus === "green", s);
    }

    // Blått räknas som ett val precis som rött och grönt — det stämplas och sparas
    stamp(caseData.id);
    saveLocal();
    applyFilters();
    renderTimeline();
    queuePush();
}

function openMysteryModal(caseData) {
    currentSelectedCase = caseData;

    // NOLLTIPS-REGELN: innan avslöjandet visas ENDAST fallnumret.
    // Ingen kategori, ingen anamnes, inga länkar, ingen mnemonic — inget som kan leda tanken.
    document.getElementById("modalCaseNumber").innerText = caseData.number ? `Fall #${caseData.number}` : `Fall #${caseData.rowIndex}`;

    const catEl = document.getElementById("modalCategory");
    catEl.innerText = caseData.category || "Generell";
    catEl.style.display = "none";

    const scenarioBox = document.getElementById("scenarioBox");
    document.getElementById("modalScenarioText").innerText = caseData.caseScenario || "";
    scenarioBox.style.display = "none";

    // Hide revealed content
    document.getElementById("mysteryContent").style.display = "none";
    document.getElementById("btnRevealDiagnosis").style.display = "inline-block";
    document.getElementById("mysteryPrompt").style.display = "block";
    document.getElementById("evalRow").style.display = "none";

    document.getElementById("modalMystery").classList.add("active");
}

function revealDiagnosis() {
    if (!currentSelectedCase) return;

    document.getElementById("btnRevealDiagnosis").style.display = "none";
    document.getElementById("mysteryPrompt").style.display = "none";
    document.getElementById("mysteryContent").style.display = "block";
    document.getElementById("evalRow").style.display = "flex";

    // Först NU (efter avslöjandet) får kategori och anamnes visas
    document.getElementById("modalCategory").style.display = "inline-block";
    const scenarioText = currentSelectedCase.caseScenario;
    const scenarioBox = document.getElementById("scenarioBox");
    scenarioBox.style.display = scenarioText ? "block" : "none";

    document.getElementById("modalDiagnosisTitle").innerText = currentSelectedCase.title.toUpperCase();

    // Mnemonic
    const mBox = document.getElementById("modalMnemonicBox");
    if (currentSelectedCase.mnemonic) {
        document.getElementById("modalMnemonic").innerText = currentSelectedCase.mnemonic;
        mBox.style.display = "block";
    } else {
        mBox.style.display = "none";
    }

    // Notes
    const nBox = document.getElementById("modalNotesBox");
    if (currentSelectedCase.notes) {
        document.getElementById("modalNotes").innerText = currentSelectedCase.notes;
        nBox.style.display = "block";
    } else {
        nBox.style.display = "none";
    }

    // Document links
    const linksRow = document.getElementById("modalLinksRow");
    linksRow.innerHTML = "";

    if (currentSelectedCase.docLink) {
        linksRow.innerHTML += `<a href="${currentSelectedCase.docLink}" target="_blank" class="badge" style="background:#6366f1; color:#fff; text-decoration:none;"><i class="fa-solid fa-file-lines"></i> Googledokument</a> `;
    }
    if (currentSelectedCase.akutaLink) {
        linksRow.innerHTML += `<a href="${currentSelectedCase.akutaLink}" target="_blank" class="badge" style="background:#10b981; color:#fff; text-decoration:none;"><i class="fa-solid fa-notes-medical"></i> Akutasjukdomar.se</a> `;
    }
}

function markCaseResult(passed) {
    if (!currentSelectedCase) return;

    if (passed) {
        caseStatuses[currentSelectedCase.id] = "green";
        userScore += 10;
        userStreak += 1;
        if (window.confetti) {
            window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
    } else {
        caseStatuses[currentSelectedCase.id] = "red";
        userStreak = 0;
    }

    const srs = scheduleCase(currentSelectedCase.id, passed);

    stamp(currentSelectedCase.id);
    saveLocal();

    updateScoreUI();
    logTraining(currentSelectedCase, passed, srs);
    closeMysteryModal();
    applyFilters();
    renderTimeline();
    queuePush();
}

/* ==========================================================================
   TIDSLINJE — varje träningstillfälle sparas med tidsstämpel
   ========================================================================== */
function logTraining(c, passed, srs) {
    trainingLog.unshift({
        id: c.id,
        number: c.number || c.rowIndex,
        title: c.title,
        passed: passed,
        at: new Date().toISOString(),
        due: srs ? srs.due : null,
        reps: srs ? srs.reps : 0
    });
    trainingLog = trainingLog.slice(0, 300);
    localStorage.setItem("medical_wheel_log", JSON.stringify(trainingLog));
}

function renderTimeline() {
    const container = document.getElementById("historyContainer");
    const summary = document.getElementById("timelineSummary");
    if (!container) return;

    if (summary) {
        const dueNow = allMedicalCases.filter(c => isDue(c.id)).length;
        summary.innerHTML = `<span>${trainingLog.length} träningstillfällen</span><span class="due-chip">⏰ ${dueNow} att repetera nu</span>`;
    }

    if (!trainingLog.length) {
        container.innerHTML = `<div class="empty-state">Snurra hjulet för att börja utmana dig själv!</div>`;
        return;
    }

    container.innerHTML = "";
    let lastDay = null;

    trainingLog.forEach(entry => {
        const day = new Date(entry.at).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
        if (day !== lastDay) {
            lastDay = day;
            const header = document.createElement("div");
            header.className = "timeline-day";
            header.innerText = day;
            container.appendChild(header);
        }

        const item = document.createElement("div");
        item.className = `history-item timeline-item ${entry.passed ? "pass" : "fail"}`;
        item.innerHTML = `
            <div class="timeline-main">
                <strong>#${entry.number}</strong>
                <span class="timeline-title">${entry.title}</span>
            </div>
            <div class="timeline-meta">
                <span class="timeline-time">${formatStamp(entry.at)}</span>
                <span class="timeline-result">${entry.passed ? "🟢 Klarad" : "🔴 Ej klarad"}</span>
                ${entry.due ? `<span class="timeline-due">🔁 repetera ${formatRelative(entry.due)}</span>` : ""}
            </div>
        `;
        container.appendChild(item);
    });
}

function closeMysteryModal() {
    document.getElementById("modalMystery")?.classList.remove("active");
}