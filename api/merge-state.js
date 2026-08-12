/* ==========================================================================
   SAMMANSLAGNING AV TILLSTÅND — delas av produktionsendpointen (api/state.js)
   och den lokala dev-servern (server.js) så båda beter sig exakt likadant.

   Regel: per fall vinner den senaste ändringen. En enhet som sparar kan
   aldrig radera ett nyare val som gjorts på en annan enhet.
   ========================================================================== */

function timeOf(map, id) {
    const v = map && map[id];
    return v ? new Date(v).getTime() : 0;
}

function mergeStates(existing, incoming) {
    if (!existing || typeof existing !== "object") return incoming;
    if (!incoming || typeof incoming !== "object") return existing;

    const merged = {
        statuses: { ...(existing.statuses || {}) },
        statusUpdatedAt: { ...(existing.statusUpdatedAt || {}) },
        srs: { ...(existing.srs || {}) },
        log: [],
        score: Math.max(
            parseInt(existing.score || 0, 10) || 0,
            parseInt(incoming.score || 0, 10) || 0
        ),
        streak: parseInt(incoming.streak || 0, 10) || 0
    };

    const inStatuses = incoming.statuses || {};
    const inAt = incoming.statusUpdatedAt || {};
    const inSrs = incoming.srs || {};

    const ids = new Set([
        ...Object.keys(merged.statuses),
        ...Object.keys(merged.statusUpdatedAt),
        ...Object.keys(inStatuses),
        ...Object.keys(inAt)
    ]);

    ids.forEach(id => {
        const existingTime = timeOf(existing.statusUpdatedAt, id);
        const incomingTime = timeOf(inAt, id);

        // Äldre inkommande ändring får inte skriva över en nyare på servern
        if (incomingTime < existingTime) return;

        // Saknar båda sidor tidsstämpel behåller vi det servern redan har
        if (incomingTime === 0 && existingTime === 0 && !(id in inStatuses) && (id in merged.statuses)) return;

        if (inStatuses[id]) merged.statuses[id] = inStatuses[id];
        else delete merged.statuses[id];

        if (inSrs[id]) merged.srs[id] = inSrs[id];
        else delete merged.srs[id];

        if (inAt[id]) merged.statusUpdatedAt[id] = inAt[id];
        else delete merged.statusUpdatedAt[id];
    });

    const seen = new Set();
    merged.log = [
        ...(Array.isArray(incoming.log) ? incoming.log : []),
        ...(Array.isArray(existing.log) ? existing.log : [])
    ]
        .filter(e => {
            if (!e || !e.at) return false;
            const k = `${e.id}|${e.at}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 300);

    return merged;
}

module.exports = { mergeStates, timeOf };
