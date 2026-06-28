import "../css/styles.css" with { type: "css" };
// const JSON_URL = 'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2022/worldcup.json';
const JSON_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/refs/heads/master/2026/worldcup.json';

// =============================================================================
// SWEEPSTAKE CONFIG
// =============================================================================

// Fast-updating fork — same schema as openfootball, updated within hours of FT
// const JSON_URL = "https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json";


// Team name aliases: maps openfootball names -> canonical sweepstake names
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

function canonicalName(name) {
  return NAME_ALIASES[name] || name;
}

// Participants
const PARTICIPANTS = [
  {
    name: "Al",
    teams: [
      { flag: "🇳🇱", name: "Netherlands", bucket: "A" },
      { flag: "🇭🇷", name: "Croatia", bucket: "B" },
      { flag: "🇳🇴", name: "Norway", bucket: "C" },
      { flag: "🇵🇦", name: "Panama", bucket: "D" },
    ],
  },
  {
    name: "Butters",
    teams: [
      { flag: "🇵🇹", name: "Portugal", bucket: "A" },
      { flag: "🇲🇦", name: "Morocco", bucket: "B" },
      { flag: "🇳🇴", name: "Norway", bucket: "C" },
      { flag: "🇨🇩", name: "DR Congo", bucket: "D" },
    ],
  },
  {
    name: "Callum",
    teams: [
      { flag: "🇫🇷", name: "France", bucket: "A" },
      { flag: "🇲🇦", name: "Morocco", bucket: "B" },
      { flag: "🇳🇴", name: "Norway", bucket: "C" },
      { flag: "🇹🇳", name: "Tunisia", bucket: "D" },
    ],
  },
  {
    name: "Carter",
    teams: [
      { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England", bucket: "A" },
      { flag: "🇨🇴", name: "Colombia", bucket: "B" },
      { flag: "🇩🇿", name: "Algeria", bucket: "C" },
      { flag: "🇨🇩", name: "DR Congo", bucket: "D" },
    ],
  },
  {
    name: "Croft",
    teams: [
      { flag: "🇫🇷", name: "France", bucket: "A" },
      { flag: "🇺🇾", name: "Uruguay", bucket: "B" },
      { flag: "🇳🇴", name: "Norway", bucket: "C" },
      { flag: "🇺🇿", name: "Uzbekistan", bucket: "D" },
    ],
  },
  {
    name: "Dene",
    teams: [
      { flag: "🇫🇷", name: "France", bucket: "A" },
      { flag: "🇸🇳", name: "Senegal", bucket: "B" },
      { flag: "🇧🇦", name: "Bosnia and Herzegovina", bucket: "C" },
      { flag: "🇹🇳", name: "Tunisia", bucket: "D" },
    ],
  },
  {
    name: "Ellis",
    teams: [
      { flag: "🇦🇷", name: "Argentina", bucket: "A" },
      { flag: "🇰🇷", name: "South Korea", bucket: "B" },
      { flag: "🇵🇾", name: "Paraguay", bucket: "C" },
      { flag: "🇳🇿", name: "New Zealand", bucket: "D" },
    ],
  },
  {
    name: "The Foreman",
    teams: [
      { flag: "🇫🇷", name: "France", bucket: "A" },
      { flag: "🇨🇴", name: "Colombia", bucket: "B" },
      { flag: "🇹🇷", name: "Türkiye", bucket: "C" },
      { flag: "🇨🇼", name: "Curaçao", bucket: "D" },
    ],
  },
  {
    name: "Jim",
    teams: [
      { flag: "🇪🇸", name: "Spain", bucket: "A" },
      { flag: "🇲🇦", name: "Morocco", bucket: "B" },
      { flag: "🇸🇪", name: "Sweden", bucket: "C" },
      { flag: "🇶🇦", name: "Qatar", bucket: "D" },
    ],
  },
  {
    name: "Wilmot",
    teams: [
      { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England", bucket: "A" },
      { flag: "🇲🇦", name: "Morocco", bucket: "B" },
      { flag: "🇳🇴", name: "Norway", bucket: "C" },
      { flag: "🇸🇦", name: "Saudi Arabia", bucket: "D" },
    ],
  },
];

// =============================================================================
// SCORING CONSTANTS
// =============================================================================

const KNOCKOUT_BONUSES = {
  "Round of 32": 3,
  "Round of 16": 5,
  "Quarter-final": 8,
  "Semi-final": 12,
  Final: 18,
};
const WIN_WORLD_CUP_BONUS = 25;
const BUCKET_KNOCKOUT_BONUS = { C: 5, D: 10 };

const KNOCKOUT_ROUNDS = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Final",
];

function isGroupMatch(m) {
  return m.group && m.group.startsWith("Group");
}
function isKnockoutMatch(m) {
  return KNOCKOUT_ROUNDS.includes(m.round);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The JSON schema uses score.ft: [team1goals, team2goals]
function hasScore(m) {
  return m.score && Array.isArray(m.score.ft) && m.score.ft.length === 2;
}

function getScore(m) {
  return { s1: m.score.ft[0], s2: m.score.ft[1] };
}

// For knockout: check for penalties (p) or extra time (et) to determine winner
function getKnockoutWinner(m, t1, t2) {
  if (m.score.p) {
    return m.score.p[0] > m.score.p[1] ? t1 : t2;
  }
  if (m.score.et) {
    return m.score.et[0] > m.score.et[1] ? t1 : t2;
  }
  const { s1, s2 } = getScore(m);
  return s1 > s2 ? t1 : t2;
}

// =============================================================================
// DATA PROCESSING
// =============================================================================

function processMatches(matches) {
  const stats = {};

  function ensure(name) {
    if (!stats[name]) {
      stats[name] = {
        groupPts: 0,
        matchResults: [],
        knockoutRoundsReached: new Set(),
        wonWorldCup: false,
      };
    }
  }

  // Filter out placeholder team names like "W74", "L12", "TBD" etc
  const isRealTeam = (name) => !/^(W\d|L\d|TBD$|\d+[A-Z])/.test(name);

  for (const m of matches) {
    const t1 = canonicalName(m.team1);
    const t2 = canonicalName(m.team2);
    if (!isRealTeam(t1) || !isRealTeam(t2)) continue;

    ensure(t1);
    ensure(t2);

    if (isGroupMatch(m)) {
      if (hasScore(m)) {
        const { s1, s2 } = getScore(m);
        const pts1 = s1 > s2 ? 3 : s1 === s2 ? 1 : 0;
        const pts2 = s2 > s1 ? 3 : s1 === s2 ? 1 : 0;
        const res1 = pts1 === 3 ? "win" : pts1 === 1 ? "draw" : "loss";
        const res2 = pts2 === 3 ? "win" : pts2 === 1 ? "draw" : "loss";
        stats[t1].groupPts += pts1;
        stats[t2].groupPts += pts2;
        stats[t1].matchResults.push({
          label: `${t1} ${s1}–${s2} ${t2}`,
          result: res1,
          pts: pts1,
          round: "Group stage",
          date: m.date,
        });
        stats[t2].matchResults.push({
          label: `${t1} ${s1}–${s2} ${t2}`,
          result: res2,
          pts: pts2,
          round: "Group stage",
          date: m.date,
        });
      } else {
        stats[t1].matchResults.push({
          label: `${t1} vs ${t2}`,
          result: "pending",
          pts: null,
          round: "Group stage",
          date: m.date,
        });
        stats[t2].matchResults.push({
          label: `${t1} vs ${t2}`,
          result: "pending",
          pts: null,
          round: "Group stage",
          date: m.date,
        });
      }
    } else if (isKnockoutMatch(m)) {
      if (hasScore(m)) {
        const { s1, s2 } = getScore(m);
        const winner = getKnockoutWinner(m, t1, t2);
        const loser = winner === t1 ? t2 : t1;
        stats[t1].knockoutRoundsReached.add(m.round);
        stats[t2].knockoutRoundsReached.add(m.round);
        const scoreStr = `${t1} ${s1}–${s2} ${t2}`;
        stats[t1].matchResults.push({
          label: scoreStr,
          result: t1 === winner ? "win" : "loss",
          pts: null,
          round: m.round,
          date: m.date,
        });
        stats[t2].matchResults.push({
          label: scoreStr,
          result: t2 === winner ? "win" : "loss",
          pts: null,
          round: m.round,
          date: m.date,
        });
        if (m.round === "Final") {
          stats[winner].wonWorldCup = true;
        }
      } else {
        // ✅ ADDED: these two lines were missing — teams now get credit for
        // reaching a round even before the match has been played
        stats[t1].knockoutRoundsReached.add(m.round);
        stats[t2].knockoutRoundsReached.add(m.round);
        stats[t1].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round: m.round, date: m.date });
        stats[t2].matchResults.push({ label: `${t1} vs ${t2}`, result: "pending", pts: null, round: m.round, date: m.date });
      }
    }
  }

  return stats;
}

// =============================================================================
// SCORE CALCULATION
// =============================================================================

function calcParticipantScore(participant, teamStats) {
  let total = 0;
  const breakdown = [];

  for (const team of participant.teams) {
    const s = teamStats[team.name];
    if (!s) {
      breakdown.push({
        ...team,
        groupPts: 0,
        knockoutPts: 0,
        bucketBonus: 0,
        total: 0,
        bonusItems: [],
        matchResults: [],
      });
      continue;
    }

    const groupPts = s.groupPts;

    let knockoutPts = 0;
    const bonusItems = [];
    for (const round of KNOCKOUT_ROUNDS) {
      if (s.knockoutRoundsReached.has(round)) {
        knockoutPts += KNOCKOUT_BONUSES[round];
        bonusItems.push({
          label: `Reached ${round}`,
          pts: KNOCKOUT_BONUSES[round],
        });
      }
    }
    if (s.wonWorldCup) {
      knockoutPts += WIN_WORLD_CUP_BONUS;
      bonusItems.push({ label: "Won World Cup", pts: WIN_WORLD_CUP_BONUS });
      updateBackground(team.flag);
      // console.log(team.flag);
    }

    let bucketBonus = 0;
    if (
      BUCKET_KNOCKOUT_BONUS[team.bucket] &&
      s.knockoutRoundsReached.size > 0
    ) {
      bucketBonus = BUCKET_KNOCKOUT_BONUS[team.bucket];
      bonusItems.push({
        label: `Bucket ${team.bucket} underdog bonus`,
        pts: bucketBonus,
      });
    }

    const teamTotal = groupPts + knockoutPts + bucketBonus;
    total += teamTotal;
    breakdown.push({
      ...team,
      groupPts,
      knockoutPts,
      bucketBonus,
      total: teamTotal,
      bonusItems,
      matchResults: s.matchResults,
    });
  }

  return { total, breakdown };
}

// =============================================================================
// RENDER
// =============================================================================
function updateBackground(flagContent) {
  const bg = document.querySelector("body");
  bg.classList.add(".winnerBackground");

  const pageHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );

// Make the background span the whole page
  bg.style.height = `${pageHeight}px`;
  bg.style.setProperty("--page-height", `${pageHeight + 120}px`);

  for (let i = 0; i < 150; i++) {
    const flag = document.createElement("span");
    flag.className = "flag";
    flag.innerHTML = `${flagContent}`;

    flag.style.left = `${Math.random() * 100}%`;
    flag.style.top = `${Math.random() * pageHeight}px`;
    flag.style.fontSize = `${24 + Math.random() * 32}px`;

    // 10–25 seconds to fall the whole page
    flag.style.animationDuration = `${10 + Math.random() * 15}s`;
    flag.style.animationDelay = `${-Math.random() * 25}s`;

    bg.appendChild(flag);
  }
}

function renderBoard(teamStats) {
  const scored = PARTICIPANTS.map((p) => {
    const { total, breakdown } = calcParticipantScore(p, teamStats);
    return { ...p, total, breakdown };
  }).sort((a, b) => b.total - a.total);

  const board = document.getElementById("board");
  board.innerHTML = "";

  let prevTotal = null,
    displayRank = 0,
    trueRank = 0;

  scored.forEach((p) => {
    trueRank++;
    if (p.total !== prevTotal) displayRank = trueRank;
    prevTotal = p.total;

    const uid = p.name.replace(/\s+/g, "-").toLowerCase();
    const rankClass = displayRank <= 3 ? `entry rank-${displayRank}` : "entry";

    // Team chips
    const teamsHTML = p.breakdown
      .map((t) => {
        const ptsHTML =
          t.total > 0 ? `<span class="tpts">+${t.total}</span>` : "";
        return `<span class="team-chip">
        <span class="tflag">${t.flag}</span>
        <span class="tname">${t.name}</span>
        <span class="tbucket-letter">${t.bucket}</span>
        ${ptsHTML}
      </span>`;
      })
      .join("");

    // Results rows
    const resultsHTML = p.breakdown
      .map((t) => {
        const matchRows =
          t.matchResults.length === 0
            ? `<div class="result-row">
            <span class="rr-flag">${t.flag}</span>
            <span class="rr-team">${t.name}</span>
            <span class="rr-result">No fixtures yet</span>
            <span class="rr-pts pending">–</span>
           </div>`
            : t.matchResults
                .map((r) => {
                  let ptsLabel = fmtDate(r.date) || "–",
                    ptsClass = "pending";
                  if (r.result === "win") {
                    ptsLabel = r.pts !== null ? `+${r.pts} pts` : "Win";
                    ptsClass = "win";
                  }
                  if (r.result === "draw") {
                    ptsLabel = r.pts !== null ? `+${r.pts} pt` : "Draw";
                    ptsClass = "draw";
                  }
                  if (r.result === "loss") {
                    ptsLabel = "+0 pts";
                    ptsClass = "loss";
                  }
                  return `<div class="result-row">
              <span class="rr-flag">${t.flag}</span>
              <span class="rr-team">${t.name}</span>
              <span class="rr-result">${r.label} <span class="rr-round">(${r.round})</span></span>
              <span class="rr-pts ${ptsClass}">${ptsLabel}</span>
            </div>`;
                })
                .join("");

        const bonusRows = t.bonusItems
          .map(
            (b) =>
              `<div class="result-row bonus-row">
          <span class="rr-flag">⭐</span>
          <span class="rr-team" style="color:var(--gold)">${t.name}</span>
          <span class="rr-result" style="color:var(--gold)">${b.label}</span>
          <span class="rr-pts bonus">+${b.pts}</span>
        </div>`,
          )
          .join("");

        return matchRows + bonusRows;
      })
      .join("");

    const el = document.createElement("div");
    el.className = rankClass;
    el.innerHTML = `
      <div class="entry-main">
        <div class="rank-num">${displayRank}</div>
        <div>
          <div class="entry-name">${p.name}</div>
          <div class="entry-teams">${teamsHTML}</div>
        </div>
        <div class="entry-score">
          <div class="score-big">${p.total}</div>
          <div class="score-label">pts</div>
        </div>
      </div>
      <button class="results-toggle" id="btn-${uid}" onclick="toggleResults('${uid}')" data-umami-event="team-results" data-umami-event-team="${p.name}">
        <span>Results &amp; fixtures</span>
        <span class="rt-arrow">▼</span>
      </button>
      <div class="results-body" id="body-${uid}">${resultsHTML}</div>
    `;
    board.appendChild(el);
  });
}

function toggleResults(uid) {
  document.getElementById("btn-" + uid).classList.toggle("open");
  document.getElementById("body-" + uid).classList.toggle("open");
}

function toggleScoring() {
  document.getElementById("scoring-btn").classList.toggle("open");
  document.getElementById("scoring-body").classList.toggle("open");
}

function toggleCommentary() {
  document.getElementById("commentary-btn").classList.toggle("open");
  document.getElementById("commentary-body").classList.toggle("open");
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
    document.getElementById("updated-pill").innerHTML =
      `Updated <strong>${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</strong>`;
  } catch (err) {
    console.error("Failed to load match data:", err);
    document.getElementById("board").innerHTML =
      `<div class="loading">Couldn't load data — please refresh. (${err.message})</div>`;
    document.getElementById("updated-pill").textContent = "Error loading data";
  }
}


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
      body.innerHTML = data.lines
        .map((line) => `<p class="commentary-line">${line}</p>`)
        .join("");
    } else {
      body.innerHTML =
        '<p class="commentary-error">No commentary available yet.</p>';
    }
  } catch (err) {
    // commentary.json doesn't exist yet (first deploy) — hide the section silently
    const section = document.getElementById("commentary-section");
    if (section) section.style.display = "none";
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
  document
    .getElementById("dillinja-btn")
    .classList.toggle("active", dillinjaActive);

  if (dillinjaActive) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
}

// =============================================================================
// GROUP TABLES
// =============================================================================

function renderGroupTables(matches) {
  // Build group -> team stats map
  const groups = {};

  // Team flags lookup (best effort from participants, fallback to '')
  const teamFlags = {};
  PARTICIPANTS.forEach((p) =>
    p.teams.forEach((t) => {
      teamFlags[t.name] = t.flag;
    }),
  );

  for (const m of matches) {
    if (!isGroupMatch(m)) continue;
    const t1 = canonicalName(m.team1);
    const t2 = canonicalName(m.team2);
    const grp = m.group;

    if (!groups[grp]) groups[grp] = {};
    [t1, t2].forEach((t) => {
      if (!groups[grp][t])
        groups[grp][t] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, played: 0 };
    });

    if (hasScore(m)) {
      const { s1, s2 } = getScore(m);
      groups[grp][t1].played++;
      groups[grp][t2].played++;
      groups[grp][t1].gf += s1;
      groups[grp][t1].ga += s2;
      groups[grp][t2].gf += s2;
      groups[grp][t2].ga += s1;
      if (s1 > s2) {
        groups[grp][t1].w++;
        groups[grp][t1].pts += 3;
        groups[grp][t2].l++;
      } else if (s1 < s2) {
        groups[grp][t2].w++;
        groups[grp][t2].pts += 3;
        groups[grp][t1].l++;
      } else {
        groups[grp][t1].d++;
        groups[grp][t1].pts++;
        groups[grp][t2].d++;
        groups[grp][t2].pts++;
      }
    }
  }

  const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const html = `<div class="groups-grid">${sortedGroups
    .map(([grp, teams]) => {
      const sorted = Object.entries(teams).sort(([, a], [, b]) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        return b.gf - b.ga - (a.gf - a.ga);
      });
      const rows = sorted
        .map(([name, s], i) => {
          const flag = teamFlags[name] || "";
          const gd = s.gf - s.ga;
          return `<tr class="${i < 2 && s.played > 0 ? "qualified" : ""}">
        <td>${name}</td>
        <td>${s.played}</td>
        <td><span class="wdl"><span class="wdl-w">${s.w}W</span> <span class="wdl-d">${s.d}D</span> <span class="wdl-l">${s.l}L</span></span></td>
        <td>${gd > 0 ? "+" : ""}${gd}</td>
        <td class="pts">${s.pts}</td>
      </tr>`;
        })
        .join("");
      return `<div class="group-table">
      <h3>${grp}</h3>
      <table>
        <thead><tr><th>Team</th><th>P</th><th>W/D/L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
    })
    .join("")}</div>`;

  document.getElementById("groups-content").innerHTML = html;
}

// =============================================================================
// KNOCKOUT STAGE
// =============================================================================

function renderKnockout(matches) {
  const roundOrder = [
    "Round of 32",
    "Round of 16",
    "Quarter-final",
    "Semi-final",
    "Final",
  ];
  const byRound = {};
  roundOrder.forEach((r) => {
    byRound[r] = [];
  });

  // Team flags lookup
  const teamFlags = {};
  PARTICIPANTS.forEach((p) =>
    p.teams.forEach((t) => {
      teamFlags[t.name] = t.flag;
    }),
  );

  for (const m of matches) {
    if (!isKnockoutMatch(m)) continue;
    if (byRound[m.round]) byRound[m.round].push(m);
  }

  const html = `<div class="knockout-rounds">${roundOrder
    .map((round) => {
      const ms = byRound[round];
      if (ms.length === 0) return "";
      const matchCards = ms
        .map((m) => {
          const t1 = canonicalName(m.team1);
          const t2 = canonicalName(m.team2);
          const f1 = teamFlags[t1] || "";
          const f2 = teamFlags[t2] || "";
          const isTbd1 = /^(W\d|L\d|TBD)/.test(m.team1);
          const isTbd2 = /^(W\d|L\d|TBD)/.test(m.team2);

          let s1 = "–",
            s2 = "–",
            win1 = false,
            win2 = false;
          if (hasScore(m)) {
            const sc = getScore(m);
            s1 = sc.s1;
            s2 = sc.s2;
            const winner = getKnockoutWinner(m, t1, t2);
            win1 = winner === t1;
            win2 = winner === t2;
          }

          const dateStr = m.date ? fmtDate(m.date) : "";
          return `<div class="ko-match">
        <div class="ko-team">
          <span class="ko-team-name ${isTbd1 ? "tbd" : ""}">${isTbd1 ? "" : f1 + " "}${isTbd1 ? m.team1 : t1}</span>
          <span class="ko-score ${win1 ? "winner" : ""}">${s1}</span>
        </div>
        <div class="ko-team">
          <span class="ko-team-name ${isTbd2 ? "tbd" : ""}">${isTbd2 ? "" : f2 + " "}${isTbd2 ? m.team2 : t2}</span>
          <span class="ko-score ${win2 ? "winner" : ""}">${s2}</span>
        </div>
        ${dateStr ? `<div class="ko-match-date">${dateStr}</div>` : ""}
      </div>`;
        })
        .join("");

      return `<div>
      <div class="ko-round-label">${round}</div>
      <div class="ko-matches">${matchCards}</div>
    </div>`;
    })
    .filter(Boolean)
    .join("")}</div>`;

  document.getElementById("knockout-content").innerHTML =
    html || '<div class="loading">No knockout fixtures yet</div>';
}

// =============================================================================
// SECTION TOGGLE
// =============================================================================

function toggleSection(id) {
  const btn = document.getElementById(id + "-btn");
  const body = document.getElementById(id + "-body");
  btn.classList.toggle("open");
  body.classList.toggle("open");
}

// =============================================================================
// INIT
// =============================================================================

loadData();
loadCommentary();

window.toggleScoring = toggleScoring;
window.toggleResults = toggleResults;
window.toggleSection = toggleSection;
window.toggleDillinja = toggleDillinja;
window.toggleCommentary = toggleCommentary;
