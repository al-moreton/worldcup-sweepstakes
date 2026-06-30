import "../css/styles.css" with { type: "css" };
// const JSON_URL = 'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2022/worldcup.json';

const JSON_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/refs/heads/master/2026/worldcup.json";

const NAME_ALIASES = {
  "Ivory Coast": "Côte d'Ivoire",
  "Cape Verde": "Cabo Verde",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Czech Republic": "Czechia",
  "Korea Republic": "South Korea",
  "Republic of Ireland": "Ireland",
  "DR Congo": "DR Congo",
  Turkey: "Türkiye",
  Curaçao: "Curaçao",
  Curacao: "Curaçao",
};

function canonicalName(name) { return NAME_ALIASES[name] || name; }

const PARTICIPANTS = [
  { name: "Al", teams: [{ flag: "🇳🇱", name: "Netherlands", bucket: "A" }, { flag: "🇭🇷", name: "Croatia", bucket: "B" }, { flag: "🇳🇴", name: "Norway", bucket: "C" }, { flag: "🇵🇦", name: "Panama", bucket: "D" }] },
  { name: "Butters", teams: [{ flag: "🇵🇹", name: "Portugal", bucket: "A" }, { flag: "🇲🇦", name: "Morocco", bucket: "B" }, { flag: "🇳🇴", name: "Norway", bucket: "C" }, { flag: "🇨🇩", name: "DR Congo", bucket: "D" }] },
  { name: "Callum", teams: [{ flag: "🇫🇷", name: "France", bucket: "A" }, { flag: "🇲🇦", name: "Morocco", bucket: "B" }, { flag: "🇳🇴", name: "Norway", bucket: "C" }, { flag: "🇹🇳", name: "Tunisia", bucket: "D" }] },
  { name: "Carter", teams: [{ flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England", bucket: "A" }, { flag: "🇨🇴", name: "Colombia", bucket: "B" }, { flag: "🇩🇿", name: "Algeria", bucket: "C" }, { flag: "🇨🇩", name: "DR Congo", bucket: "D" }] },
  { name: "Croft", teams: [{ flag: "🇫🇷", name: "France", bucket: "A" }, { flag: "🇺🇾", name: "Uruguay", bucket: "B" }, { flag: "🇳🇴", name: "Norway", bucket: "C" }, { flag: "🇺🇿", name: "Uzbekistan", bucket: "D" }] },
  { name: "Dene", teams: [{ flag: "🇫🇷", name: "France", bucket: "A" }, { flag: "🇸🇳", name: "Senegal", bucket: "B" }, { flag: "🇧🇦", name: "Bosnia and Herzegovina", bucket: "C" }, { flag: "🇹🇳", name: "Tunisia", bucket: "D" }] },
  { name: "Ellis", teams: [{ flag: "🇦🇷", name: "Argentina", bucket: "A" }, { flag: "🇰🇷", name: "South Korea", bucket: "B" }, { flag: "🇵🇾", name: "Paraguay", bucket: "C" }, { flag: "🇳🇿", name: "New Zealand", bucket: "D" }] },
  { name: "The Foreman", teams: [{ flag: "🇫🇷", name: "France", bucket: "A" }, { flag: "🇨🇴", name: "Colombia", bucket: "B" }, { flag: "🇹🇷", name: "Türkiye", bucket: "C" }, { flag: "🇨🇼", name: "Curaçao", bucket: "D" }] },
  { name: "Jim", teams: [{ flag: "🇪🇸", name: "Spain", bucket: "A" }, { flag: "🇲🇦", name: "Morocco", bucket: "B" }, { flag: "🇸🇪", name: "Sweden", bucket: "C" }, { flag: "🇶🇦", name: "Qatar", bucket: "D" }] },
  { name: "Wilmot", teams: [{ flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England", bucket: "A" }, { flag: "🇲🇦", name: "Morocco", bucket: "B" }, { flag: "🇳🇴", name: "Norway", bucket: "C" }, { flag: "🇸🇦", name: "Saudi Arabia", bucket: "D" }] },
];

const KNOCKOUT_BONUSES = { "Round of 32": 3, "Round of 16": 5, "Quarter-final": 8, "Semi-final": 12, Final: 18 };
const WIN_WORLD_CUP_BONUS = 25;
const BUCKET_KNOCKOUT_BONUS = { C: 5, D: 10 };
const KNOCKOUT_ROUNDS = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"];

// Normalizes round name spelling variants across different feed versions to one canonical form
const ROUND_ALIASES = {
  "Quarter-finals": "Quarter-final",
  "Semi-finals": "Semi-final",
};
function canonicalRound(round) { return ROUND_ALIASES[round] || round; }

// Maps a round to the round a win in it guarantees progression to
const NEXT_ROUND = {
  "Round of 32": "Round of 16",
  "Round of 16": "Quarter-final",
  "Quarter-final": "Semi-final",
  "Semi-final": "Final",
};

function isGroupMatch(m) { return m.group && m.group.startsWith("Group"); }
function isKnockoutMatch(m) { return KNOCKOUT_ROUNDS.includes(canonicalRound(m.round)) || m.round === "Match for third place"; }
function fmtDate(dateStr) { if (!dateStr) return ""; const d = new Date(dateStr); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function hasScore(m) { return m.score && Array.isArray(m.score.ft) && m.score.ft.length === 2; }
function getScore(m) { return { s1: m.score.ft[0], s2: m.score.ft[1] }; }
function getKnockoutWinner(m, t1, t2) {
  if (m.score.p) return m.score.p[0] > m.score.p[1] ? t1 : t2;
  if (m.score.et) return m.score.et[0] > m.score.et[1] ? t1 : t2;
  const { s1, s2 } = getScore(m);
  return s1 > s2 ? t1 : t2;
}
// A draw after 90 mins goes to extra time; if still level, it's decided on penalties.
// Picks the score that actually decided the match (ft, unless et/pens were needed) and
// annotates it accordingly, since showing the (drawn) ft score alone would be misleading.
function knockoutScoreLine(m, t1, t2) {
  const { s1, s2 } = getScore(m);
  if (m.score.p) return `${t1} ${s1}–${s2} ${t2} (${m.score.p[0]}–${m.score.p[1]} pens)`;
  if (m.score.et) return `${t1} ${m.score.et[0]}–${m.score.et[1]} ${t2} (aet)`;
  return `${t1} ${s1}–${s2} ${t2}`;
}

function processMatches(matches) {
  const stats = {};
  function ensure(name) {
    if (!stats[name]) stats[name] = { groupPts: 0, matchResults: [], knockoutRoundsReached: new Set(), wonWorldCup: false, eliminated: false, eliminatedNote: "" };
  }
  const isRealTeam = (name) => !/^(W\d|L\d|TBD$|\d+[A-Z])/.test(name);
  for (const m of matches) {
    const t1 = canonicalName(m.team1);
    const t2 = canonicalName(m.team2);
    if (!isRealTeam(t1) || !isRealTeam(t2)) continue;
    ensure(t1); ensure(t2);
    if (isGroupMatch(m)) {
      if (hasScore(m)) {
        const { s1, s2 } = getScore(m);
        const pts1 = s1 > s2 ? 3 : s1 === s2 ? 1 : 0;
        const pts2 = s2 > s1 ? 3 : s1 === s2 ? 1 : 0;
        stats[t1].groupPts += pts1; stats[t2].groupPts += pts2;
        stats[t1].matchResults.push({ label: `${t1} ${s1}–${s2} ${t2}`, result: pts1 === 3 ? "win" : pts1 === 1 ? "draw" : "loss", pts: pts1, round: "Group stage", date: m.date });
        stats[t2].matchResults.push({ label: `${t1} ${s1}–${s2} ${t2}`, result: pts2 === 3 ? "win" : pts2 === 1 ? "draw" : "loss", pts: pts2, round: "Group stage", date: m.date });
      } else {
        stats[t1].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round: "Group stage", date: m.date });
        stats[t2].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round: "Group stage", date: m.date });
      }
    } else if (isKnockoutMatch(m)) {
      const round = canonicalRound(m.round);
      if (hasScore(m)) {
        const winner = getKnockoutWinner(m, t1, t2);
        const loser = winner === t1 ? t2 : t1;
        stats[t1].knockoutRoundsReached.add(round); stats[t2].knockoutRoundsReached.add(round);
        const scoreStr = knockoutScoreLine(m, t1, t2);
        stats[t1].matchResults.push({ label: scoreStr, result: t1 === winner ? "win" : "loss", pts: null, round, date: m.date });
        stats[t2].matchResults.push({ label: scoreStr, result: t2 === winner ? "win" : "loss", pts: null, round, date: m.date });
        const nextRound = NEXT_ROUND[round];
        if (nextRound) stats[winner].knockoutRoundsReached.add(nextRound);
        if (round === "Final") stats[winner].wonWorldCup = true;
        if (round !== "Match for third place") {
          stats[loser].eliminated = true;
          stats[loser].eliminatedNote = `Knocked out in ${round} (lost ${scoreStr})`;
        }
      } else {
        stats[t1].knockoutRoundsReached.add(round);
        stats[t2].knockoutRoundsReached.add(round);
        stats[t1].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round, date: m.date });
        stats[t2].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round, date: m.date });
      }
    }
  }

  // Determine group-stage elimination: bottom 2 of group once all 3 games played,
  // EXCEPT we can't know in advance if a 3rd-place team sneaks through (8 best 3rds qualify in 2026),
  // so only mark as eliminated if the team has zero knockout fixtures at all and all group games are done.
  const groupGamesPlayed = {};
  for (const m of matches) {
    if (!isGroupMatch(m)) continue;
    const t1 = canonicalName(m.team1), t2 = canonicalName(m.team2);
    if (!isRealTeam(t1) || !isRealTeam(t2)) continue;
    groupGamesPlayed[t1] = (groupGamesPlayed[t1] || 0) + (hasScore(m) ? 1 : 0);
    groupGamesPlayed[t2] = (groupGamesPlayed[t2] || 0) + (hasScore(m) ? 1 : 0);
  }
  const knockoutAppearances = new Set();
  for (const m of matches) {
    if (!isKnockoutMatch(m)) continue;
    const t1 = canonicalName(m.team1), t2 = canonicalName(m.team2);
    if (isRealTeam(t1)) knockoutAppearances.add(t1);
    if (isRealTeam(t2)) knockoutAppearances.add(t2);
  }
  // Only apply this once knockout fixtures with real team names exist at all (i.e. bracket has resolved)
  if (knockoutAppearances.size > 0) {
    for (const [team, played] of Object.entries(groupGamesPlayed)) {
      if (played >= 3 && stats[team] && !knockoutAppearances.has(team) && !stats[team].eliminated) {
        stats[team].eliminated = true;
        stats[team].eliminatedNote = "Eliminated in the group stage";
      }
    }
  }

  // If a team's most recent knockout result was a win, show their next round as an
  // upcoming fixture, even if the feed hasn't resolved an opponent for it yet — the
  // bracket only lists matches once both sides are known, so without this the team's
  // next stage (and its "Reached <round>" bonus) would silently vanish until then.
  for (const [team, s] of Object.entries(stats)) {
    if (s.eliminated || s.wonWorldCup) continue;
    let lastWonRoundIndex = -1;
    for (const r of s.matchResults) {
      if (r.result === "win") {
        const idx = KNOCKOUT_ROUNDS.indexOf(r.round);
        if (idx > lastWonRoundIndex) lastWonRoundIndex = idx;
      }
    }
    if (lastWonRoundIndex === -1) continue;
    const nextRound = NEXT_ROUND[KNOCKOUT_ROUNDS[lastWonRoundIndex]];
    if (!nextRound) continue;
    if (!s.matchResults.some((r) => r.round === nextRound)) {
      s.matchResults.push({ label: `${team} vs TBC`, result: "pending", pts: null, round: nextRound, date: null });
    }
  }

  return stats;
}

function calcParticipantScore(participant, teamStats) {
  let total = 0;
  const breakdown = [];
  for (const team of participant.teams) {
    const s = teamStats[team.name];
    // console.log(teamStats[team.name]);
    if (!s) { breakdown.push({ ...team, groupPts: 0, knockoutPts: 0, bucketBonus: 0, total: 0, bonusItems: [], matchResults: [], eliminated: false, eliminatedNote: "" }); continue; }
    const groupPts = s.groupPts;
    let knockoutPts = 0;
    const bonusItems = [];
    for (const round of KNOCKOUT_ROUNDS) {
      if (s.knockoutRoundsReached.has(round)) { knockoutPts += KNOCKOUT_BONUSES[round]; bonusItems.push({ label: `Reached ${round}`, pts: KNOCKOUT_BONUSES[round] }); }
    }
    if (s.wonWorldCup) { knockoutPts += WIN_WORLD_CUP_BONUS; bonusItems.push({ label: "Won World Cup", pts: WIN_WORLD_CUP_BONUS }); }
    let bucketBonus = 0;
    if (BUCKET_KNOCKOUT_BONUS[team.bucket] && s.knockoutRoundsReached.size > 0) { bucketBonus = BUCKET_KNOCKOUT_BONUS[team.bucket]; bonusItems.push({ label: `Bucket ${team.bucket} underdog bonus`, pts: bucketBonus }); }
    const teamTotal = groupPts + knockoutPts + bucketBonus;
    total += teamTotal;
    breakdown.push({ ...team, groupPts, knockoutPts, bucketBonus, total: teamTotal, bonusItems, matchResults: s.matchResults, eliminated: s.eliminated, eliminatedNote: s.eliminatedNote });
  }
  return { total, breakdown };
}

function renderBoard(teamStats) {
  const scored = PARTICIPANTS.map((p) => { const { total, breakdown } = calcParticipantScore(p, teamStats); return { ...p, total, breakdown }; }).sort((a, b) => b.total - a.total);
  const board = document.getElementById("board");
  board.innerHTML = "";
  let prevTotal = null, displayRank = 0, trueRank = 0;
  scored.forEach((p) => {
    trueRank++;
    if (p.total !== prevTotal) displayRank = trueRank;
    prevTotal = p.total;
    const uid = p.name.replace(/\s+/g, "-").toLowerCase();
    const rankClass = displayRank <= 3 ? `entry rank-${displayRank}` : "entry";
    const teamsHTML = p.breakdown.map((t) => { const ptsHTML = t.total > 0 ? `<span class="tpts">+${t.total}</span>` : ""; return `<span class="team-chip"><span class="tflag">${t.flag}</span><span class="tname">${t.name}</span><span class="tbucket-letter">${t.bucket}</span>${ptsHTML}</span>`; }).join("");
    const resultsHTML = p.breakdown.map((t) => {
      if (t.matchResults.length === 0) {
        return `<div class="team-results-group"><div class="result-row"><span class="rr-flag">${t.flag}</span><span class="rr-team">${t.name}</span><span class="rr-result">No fixtures yet</span><span class="rr-pts pending">–</span></div></div>`;
      }

      // Build a lookup of bonus items by the round they were earned for, so they can be
      // interleaved directly after that round's match row rather than dumped at the end.
      // The bucket C/D underdog bonus is earned on reaching the knockout stage, so it's
      // grouped with the "Reached Round of 32" bonus.
      const bonusByRound = {};
      t.bonusItems.forEach((b) => {
        const reachedMatch = b.label.match(/^Reached (.+)$/);
        const isBucketBonus = /underdog bonus$/.test(b.label);
        const key = reachedMatch
          ? reachedMatch[1] // If it matched "Reached...", use the captured round immediately
          : b.label === "Won World Cup"
            ? "Final"
            : isBucketBonus
              ? "Round of 32"
              : null;
        if (key) { if (!bonusByRound[key]) bonusByRound[key] = []; bonusByRound[key].push(b); }
      });

      const renderedRounds = new Set();
      const rows = t.matchResults.map((r) => {
        let ptsLabel = fmtDate(r.date) || "–", ptsClass = "pending";
        if (r.result === "win") { ptsLabel = r.pts !== null ? `+${r.pts} pts` : "Win"; ptsClass = "win"; }
        if (r.result === "draw") { ptsLabel = r.pts !== null ? `+${r.pts} pt` : "Draw"; ptsClass = "draw"; }
        if (r.result === "loss") { ptsLabel = r.pts !== null ? "+0 pts" : "Loss"; ptsClass = "loss"; }
        const matchRow = `<div class="result-row"><span class="rr-flag">${t.flag}</span><span class="rr-team">${t.name}</span><span class="rr-result">${r.label} <span class="rr-round">(${r.round})</span></span><span class="rr-pts ${ptsClass}">${ptsLabel}</span></div>`;

        // Show the bonus for reaching this round right above its match row, but only once
        let bonusRow = "";
        if (bonusByRound[r.round] && !renderedRounds.has(r.round)) {
          renderedRounds.add(r.round);
          bonusRow = bonusByRound[r.round].map((b) => `<div class="result-row bonus-row"><span class="rr-flag">⭐</span><span class="rr-team" style="color:var(--gold)">${t.name}</span><span class="rr-result" style="color:var(--gold)">${b.label}</span><span class="rr-pts bonus">+${b.pts}</span></div>`).join("");
        }
        return bonusRow + matchRow;
      }).join("");

      // Any bonuses with no round key, or whose round has no fixture yet (e.g. progressed
      // to the next round before that round's match has been scheduled), go at the end.
      const leftoverBonusItems = t.bonusItems.filter((b) => {
        const reachedMatch = b.label.match(/^Reached (.+)$/);
        const isBucketBonus = /underdog bonus$/.test(b.label);
        const key = reachedMatch ? reachedMatch[1]
          : b.label === "Won World Cup" ? "Final"
            : isBucketBonus ? "Round of 32"
              : null;
        return !key || !renderedRounds.has(key);
      });
      const leftoverRows = leftoverBonusItems.map((b) => `<div class="result-row bonus-row"><span class="rr-flag">⭐</span><span class="rr-team" style="color:var(--gold)">${t.name}</span><span class="rr-result" style="color:var(--gold)">${b.label}</span><span class="rr-pts bonus">+${b.pts}</span></div>`).join("");

      const eliminatedRow = t.eliminated
        ? `<div class="result-row eliminated-row"><span class="rr-flag">❌</span><span class="rr-team" style="color:var(--red)">${t.name}</span><span class="rr-result" style="color:var(--red)">${t.eliminatedNote}</span><span class="rr-pts loss">OUT</span></div>`
        : "";

      return `<div class="team-results-group">${rows}${leftoverRows}${eliminatedRow}</div>`;
    }).join("");
    const el = document.createElement("div");
    el.className = rankClass;
    el.innerHTML = `<div class="entry-main"><div class="rank-num">${displayRank}</div><div><div class="entry-name">${p.name}</div><div class="entry-teams">${teamsHTML}</div></div><div class="entry-score"><div class="score-big">${p.total}</div><div class="score-label">pts</div></div></div><button class="results-toggle" id="btn-${uid}" onclick="toggleResults('${uid}')" data-umami-event="team-results" data-umami-event-team="${p.name}"><span>Results &amp; fixtures</span><span class="rt-arrow">▼</span></button><div class="results-body" id="body-${uid}">${resultsHTML}</div>`;
    board.appendChild(el);
  });
}

function toggleResults(uid) { document.getElementById("btn-" + uid).classList.toggle("open"); document.getElementById("body-" + uid).classList.toggle("open"); }
function toggleScoring() { document.getElementById("scoring-btn").classList.toggle("open"); document.getElementById("scoring-body").classList.toggle("open"); }

// =============================================================================
// COMMENTARY
// =============================================================================

async function loadCommentary() {
  try {
    const res = await fetch("commentary.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const body = document.getElementById("commentary-body");
    const stamp = document.getElementById("commentary-stamp");
    if (data.generated) {
      const d = new Date(data.generated);
      stamp.textContent = `Generated ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (data.lines && data.lines.length) {
      body.innerHTML = data.lines.map((line) => `<p class="commentary-line">${line}</p>`).join("");
    } else {
      body.innerHTML = '<p class="commentary-error">No commentary available yet.</p>';
    }
  } catch (err) {
    const section = document.getElementById("commentary-section");
    if (section) section.style.display = "none";
  }
}

// =============================================================================
// FETCH & INIT
// =============================================================================

async function loadData() {
  try {
    const res = await fetch(JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const matches = data.matches || [];
    const teamStats = processMatches(matches);
    renderBoard(teamStats);
    renderGroupTables(matches);
    renderKnockout(matches);
    const now = new Date();
    document.getElementById("updated-pill").innerHTML = `Updated <strong>${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong>`;
  } catch (err) {
    console.error("Failed to load match data:", err);
    document.getElementById("board").innerHTML = `<div class="loading">Couldn't load data — please refresh. (${err.message})</div>`;
    document.getElementById("updated-pill").textContent = "Error loading data";
  }
}

// =============================================================================
// DILLINJA MODE
// =============================================================================

const audioPlayer = document.getElementById("audioPlayer");
let dillinjaActive = false;
function toggleDillinja() {
  dillinjaActive = !dillinjaActive;
  document.body.classList.toggle("dillinja-mode", dillinjaActive);
  document.getElementById("dillinja-btn").classList.toggle("active", dillinjaActive);
  if (dillinjaActive) { audioPlayer.play(); } else { audioPlayer.pause(); }
}

// =============================================================================
// GROUP TABLES
// =============================================================================

function renderGroupTables(matches) {
  const groups = {};
  const teamFlags = {};
  PARTICIPANTS.forEach((p) => p.teams.forEach((t) => { teamFlags[t.name] = t.flag; }));
  for (const m of matches) {
    if (!isGroupMatch(m)) continue;
    const t1 = canonicalName(m.team1), t2 = canonicalName(m.team2), grp = m.group;
    if (!groups[grp]) groups[grp] = {};
    [t1, t2].forEach((t) => { if (!groups[grp][t]) groups[grp][t] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 }; });
    if (hasScore(m)) {
      const { s1, s2 } = getScore(m);
      groups[grp][t1].played++; groups[grp][t2].played++;
      groups[grp][t1].gf += s1; groups[grp][t1].ga += s2;
      groups[grp][t2].gf += s2; groups[grp][t2].ga += s1;
      if (s1 > s2) { groups[grp][t1].w++; groups[grp][t1].pts += 3; groups[grp][t2].l++; }
      else if (s1 < s2) { groups[grp][t2].w++; groups[grp][t2].pts += 3; groups[grp][t1].l++; }
      else { groups[grp][t1].d++; groups[grp][t1].pts++; groups[grp][t2].d++; groups[grp][t2].pts++; }
    }
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  const html = `<div class="groups-grid">${sortedGroups.map(([grp, teams]) => {
    const sorted = Object.entries(teams).sort(([, a], [, b]) => b.pts !== a.pts ? b.pts - a.pts : (b.gf - b.ga) - (a.gf - a.ga));
    const rows = sorted.map(([name, s], i) => { const gd = s.gf - s.ga; return `<tr class="${i < 2 && s.played > 0 ? "qualified" : ""}"><td>${name}</td><td>${s.played}</td><td><span class="wdl"><span class="wdl-w">${s.w}W</span> <span class="wdl-d">${s.d}D</span> <span class="wdl-l">${s.l}L</span></span></td><td>${gd > 0 ? "+" : ""}${gd}</td><td class="pts">${s.pts}</td></tr>`; }).join("");
    return `<div class="group-table"><h3>${grp}</h3><table><thead><tr><th>Team</th><th>P</th><th>W/D/L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("")}</div>`;
  document.getElementById("groups-content").innerHTML = html;
}

// =============================================================================
// KNOCKOUT STAGE
// =============================================================================

function renderKnockout(matches) {
  const roundOrder = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Final"];
  const byRound = {};
  roundOrder.forEach((r) => { byRound[r] = []; });
  const teamFlags = {};
  PARTICIPANTS.forEach((p) => p.teams.forEach((t) => { teamFlags[t.name] = t.flag; }));
  for (const m of matches) { if (!isKnockoutMatch(m)) continue; const r = canonicalRound(m.round); if (byRound[r]) byRound[r].push(m); }
  const html = `<div class="knockout-rounds">${roundOrder.map((round) => {
    const ms = byRound[round];
    if (ms.length === 0) return "";
    const matchCards = ms.map((m) => {
      const t1 = canonicalName(m.team1), t2 = canonicalName(m.team2);
      const f1 = teamFlags[t1] || "", f2 = teamFlags[t2] || "";
      const isTbd1 = /^(W\d|L\d|TBD)/.test(m.team1), isTbd2 = /^(W\d|L\d|TBD)/.test(m.team2);
      let s1 = "–", s2 = "–", win1 = false, win2 = false, noteStr = "";
      if (hasScore(m)) {
        const sc = getScore(m);
        const winner = getKnockoutWinner(m, t1, t2); win1 = winner === t1; win2 = winner === t2;
        if (m.score.p) {
          // ft is still level when it went to pens, so it's the right score to show in the box
          s1 = sc.s1; s2 = sc.s2;
          noteStr = `${winner} won ${Math.max(m.score.p[0], m.score.p[1])}–${Math.min(m.score.p[0], m.score.p[1])} on penalties`;
        } else if (m.score.et) {
          // ft was level (that's why it went to extra time) so the et score is the real result
          s1 = m.score.et[0]; s2 = m.score.et[1];
          noteStr = "Won after extra time";
        } else {
          s1 = sc.s1; s2 = sc.s2;
        }
      }
      const dateStr = m.date ? fmtDate(m.date) : "";
      return `<div class="ko-match"><div class="ko-team"><span class="ko-team-name ${isTbd1 ? "tbd" : ""}">${isTbd1 ? "" : f1 + " "}${isTbd1 ? m.team1 : t1}</span><span class="ko-score ${win1 ? "winner" : ""}">${s1}</span></div><div class="ko-team"><span class="ko-team-name ${isTbd2 ? "tbd" : ""}">${isTbd2 ? "" : f2 + " "}${isTbd2 ? m.team2 : t2}</span><span class="ko-score ${win2 ? "winner" : ""}">${s2}</span></div>${noteStr ? `<div class="ko-match-note">${noteStr}</div>` : ""}${dateStr ? `<div class="ko-match-date">${dateStr}</div>` : ""}</div>`;
    }).join("");
    return `<div><div class="ko-round-label">${round}</div><div class="ko-matches">${matchCards}</div></div>`;
  }).filter(Boolean).join("")}</div>`;
  document.getElementById("knockout-content").innerHTML = html || '<div class="loading">No knockout fixtures yet</div>';
}

// =============================================================================
// SECTION TOGGLE
// =============================================================================

function toggleSection(id) { document.getElementById(id + "-btn").classList.toggle("open"); document.getElementById(id + "-body").classList.toggle("open"); }

// =============================================================================
// INIT
// =============================================================================

loadData();
loadCommentary();

window.toggleScoring = toggleScoring;
window.toggleResults = toggleResults;
window.toggleSection = toggleSection;
window.toggleDillinja = toggleDillinja;