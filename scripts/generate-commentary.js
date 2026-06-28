#!/usr/bin/env node
// generate-commentary.js
// Fetches live World Cup data, builds context, calls Anthropic, writes commentary.json
// Skips the API call if nothing has changed since the last run.

const fs   = require('fs');
const path = require('path');
const https = require('https');

const COMMENTARY_PATH = path.join(__dirname, '..', 'dist', 'commentary.json');
const DATA_URL = 'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Sweepstake config (must mirror sweepstake.js)
// ---------------------------------------------------------------------------

const NAME_ALIASES = {
  'Ivory Coast':          "Côte d'Ivoire",
  'Cape Verde':           'Cabo Verde',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Czech Republic':       'Czechia',
  'Korea Republic':       'South Korea',
  'Turkey':               'Türkiye',
  'Curaçao':              'Curaçao',
  'Curacao':              'Curaçao',
};

function canon(name) { return NAME_ALIASES[name] || name; }

const PARTICIPANTS = [
  { name: 'Al',          teams: ['Netherlands','Croatia','Norway','Panama'] },
  { name: 'Butters',     teams: ['Portugal','Morocco','Norway','DR Congo'] },
  { name: 'Callum',      teams: ['France','Morocco','Norway','Tunisia'] },
  { name: 'Carter',      teams: ['England','Colombia','Algeria','DR Congo'] },
  { name: 'Croft',       teams: ['France','Uruguay','Norway','Uzbekistan'] },
  { name: 'Dene',        teams: ['France','Senegal','Bosnia and Herzegovina','Tunisia'] },
  { name: 'Ellis',       teams: ['Argentina','South Korea','Paraguay','New Zealand'] },
  { name: 'The Foreman', teams: ['France','Colombia','Türkiye','Curaçao'] },
  { name: 'Jim',         teams: ['Spain','Morocco','Sweden','Qatar'] },
  { name: 'Wilmot',      teams: ['England','Morocco','Norway','Saudi Arabia'] },
];

// Map team name -> participant name(s)
function buildOwnerMap() {
  const map = {};
  for (const p of PARTICIPANTS) {
    for (const t of p.teams) {
      if (!map[t]) map[t] = [];
      map[t].push(p.name);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'sweepstake-bot/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function postJson(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = https.request(url, opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Response parse failed: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

function hasScore(m) {
  return m.score && Array.isArray(m.score.ft) && m.score.ft.length === 2;
}

function isGroupMatch(m)    { return m.group && m.group.startsWith('Group'); }
function isKnockoutMatch(m) {
  return ['Round of 32','Round of 16','Quarter-final','Quarter-finals','Semi-final','Semi-finals','Final'].includes(m.round);
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Build prompt context from match data
// ---------------------------------------------------------------------------

function buildContext(matches, ownerMap) {
  const todayStr     = today();
  const yesterdayStr = yesterday();

  const recentResults = [];
  const upcomingToday = [];
  const groupStandings = {};
  const isInKnockout = new Set();
  const eliminatedInKnockout = new Set();

  // --- Group stage ---
  for (const m of matches) {
    if (!isGroupMatch(m)) continue;
    const t1 = canon(m.team1);
    const t2 = canon(m.team2);
    const grp = m.group || m.round;
    if (!groupStandings[grp]) groupStandings[grp] = {};
    [t1, t2].forEach(t => { if (!groupStandings[grp][t]) groupStandings[grp][t] = { pts:0,w:0,d:0,l:0,gf:0,ga:0,played:0 }; });
    if (hasScore(m)) {
      const [s1, s2] = m.score.ft;
      groupStandings[grp][t1].played++; groupStandings[grp][t2].played++;
      groupStandings[grp][t1].gf += s1; groupStandings[grp][t1].ga += s2;
      groupStandings[grp][t2].gf += s2; groupStandings[grp][t2].ga += s1;
      if (s1 > s2) { groupStandings[grp][t1].pts += 3; groupStandings[grp][t1].w++; groupStandings[grp][t2].l++; }
      else if (s2 > s1) { groupStandings[grp][t2].pts += 3; groupStandings[grp][t2].w++; groupStandings[grp][t1].l++; }
      else { groupStandings[grp][t1].pts++; groupStandings[grp][t1].d++; groupStandings[grp][t2].pts++; groupStandings[grp][t2].d++; }
      if (m.date === todayStr || m.date === yesterdayStr) {
        const o1 = (ownerMap[t1] || []).join(' & ') || '—';
        const o2 = (ownerMap[t2] || []).join(' & ') || '—';
        recentResults.push(`${t1} (${o1}) ${s1}–${s2} ${t2} (${o2}) [Group stage]`);
      }
    } else if (m.date === todayStr) {
      const o1 = (ownerMap[t1] || []).join(' & ') || '—';
      const o2 = (ownerMap[t2] || []).join(' & ') || '—';
      upcomingToday.push(`${t1} (${o1}) vs ${t2} (${o2}) [Group stage]`);
    }
  }

  // Work out which teams were eliminated in the group stage (bottom 2 per group, all games played)
  const groupEliminatedTeams = new Set();
  for (const [grp, teams] of Object.entries(groupStandings)) {
    const entries = Object.entries(teams);
    const allPlayed = entries.every(([,s]) => s.played >= 2);
    if (!allPlayed) continue;
    const sorted = entries.sort(([,a],[,b]) => b.pts - a.pts || (b.gf-b.ga)-(a.gf-a.ga));
    sorted.slice(2).forEach(([name]) => groupEliminatedTeams.add(name));
  }

  // --- Knockout stage ---
  for (const m of matches) {
    if (!isKnockoutMatch(m)) continue;
    const skipTbd = name => /^(W\d|L\d|TBD|\d+[A-Z])/.test(name);
    if (skipTbd(m.team1) || skipTbd(m.team2)) continue;
    const t1 = canon(m.team1);
    const t2 = canon(m.team2);
    isInKnockout.add(t1); isInKnockout.add(t2);
    if (hasScore(m)) {
      const [s1, s2] = m.score.ft;
      let winner;
      if (m.score.p) winner = m.score.p[0] > m.score.p[1] ? t1 : t2;
      else if (m.score.et) winner = m.score.et[0] > m.score.et[1] ? t1 : t2;
      else winner = s1 > s2 ? t1 : t2;
      const loser = winner === t1 ? t2 : t1;
      if (m.round !== 'Match for third place') eliminatedInKnockout.add(loser);
      if (m.date === todayStr || m.date === yesterdayStr) {
        const o1 = (ownerMap[t1] || []).join(' & ') || '—';
        const o2 = (ownerMap[t2] || []).join(' & ') || '—';
        recentResults.push(`${t1} (${o1}) ${s1}–${s2} ${t2} (${o2}) [${m.round}]`);
      }
    } else if (m.date === todayStr) {
      const o1 = (ownerMap[t1] || []).join(' & ') || '—';
      const o2 = (ownerMap[t2] || []).join(' & ') || '—';
      upcomingToday.push(`${t1} (${o1}) vs ${t2} (${o2}) [${m.round}]`);
    }
  }

  // Tournament stage
  const isInKnockoutStage = isInKnockout.size > 0;
  const currentStage = isInKnockoutStage ? 'Knockout stage' : 'Group stage';

  // Per-participant team status
  const participantStatus = PARTICIPANTS.map(p => {
    const teamStatuses = p.teams.map(team => {
      if (eliminatedInKnockout.has(team)) return `${team}: eliminated in knockout stage`;
      if (groupEliminatedTeams.has(team)) return `${team}: eliminated in group stage`;
      if (isInKnockout.has(team)) return `${team}: still in (knockout stage)`;
      return `${team}: group stage in progress`;
    });
    return `${p.name}: ${teamStatuses.join(' | ')}`;
  }).join('\n');

  // Sweepstake standings
  const sweepstakeStandings = PARTICIPANTS.map(p => {
    let pts = 0;
    for (const team of p.teams) {
      for (const grp of Object.values(groupStandings)) {
        if (grp[team]) pts += grp[team].pts;
      }
      if (isInKnockout.has(team)) pts += 3;
    }
    return { name: p.name, pts, teams: p.teams };
  }).sort((a,b) => b.pts - a.pts);

  const sweepstakeLines = sweepstakeStandings
    .map((p, i) => `  ${i+1}. ${p.name} — ${p.pts}pts (${p.teams.join(', ')})`)
    .join('\n');

  // Group standings (only during group stage)
  const standingLines = [];
  if (!isInKnockoutStage) {
    for (const [grp, teams] of Object.entries(groupStandings).sort()) {
      const sorted = Object.entries(teams).sort(([,a],[,b]) => b.pts - a.pts || (b.gf-b.ga)-(a.gf-a.ga));
      const line = sorted.map(([name, s], i) => {
        const owners = (ownerMap[name] || []).join('/') || '—';
        return `  ${i+1}. ${name} (${owners}) ${s.pts}pts ${s.w}W${s.d}D${s.l}L`;
      }).join('\n');
      standingLines.push(`${grp}:\n${line}`);
    }
  }

  return {
    recentResults,
    upcomingToday,
    standingLines,
    sweepstakeLines,
    participantStatus,
    currentStage,
    isInKnockoutStage,
    hasActivity: recentResults.length > 0 || upcomingToday.length > 0,
  };
}


// ---------------------------------------------------------------------------
// Detect if data changed since last run
// ---------------------------------------------------------------------------

function fingerprint(ctx) {
  return JSON.stringify({ r: ctx.recentResults, u: ctx.upcomingToday });
}

function lastFingerprint() {
  try {
    const c = JSON.parse(fs.readFileSync(COMMENTARY_PATH, 'utf8'));
    return c.fingerprint || '';
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Call Anthropic
// ---------------------------------------------------------------------------

async function generateCommentary(ctx) {
  const prompt = `You are a witty, slightly sarky football commentator writing a daily briefing for a World Cup 2026 sweepstake between a group of mates. Keep it punchy, specific, funny, feel free to be a bit mean.

TOURNAMENT STAGE: ${ctx.currentStage}

SWEEPSTAKE STANDINGS (approximate points including R32 bonus where applicable):
${ctx.sweepstakeLines}

EACH PARTICIPANT'S TEAM STATUS:
${ctx.participantStatus}

RECENT RESULTS (last 48hrs):
${ctx.recentResults.length ? ctx.recentResults.join('\n') : 'No recent results yet.'}

TODAY'S UPCOMING FIXTURES:
${ctx.upcomingToday.length ? ctx.upcomingToday.join('\n') : 'No fixtures today.'}

${!ctx.isInKnockoutStage && ctx.standingLines.length ? `GROUP STANDINGS:\n${ctx.standingLines.join('\n\n')}` : ''}

Write a briefing of 3–5 punchy lines. Rules:
- We are in the ${ctx.currentStage} — do NOT talk about group stages or group winners if we are in the knockout stage
- Call out participants by name and mention their specific teams
- Reference the sweepstake leaderboard position (1st, 2nd, last etc) when calling people out — e.g. "Jim sits top on 18pts" or "The Foreman is propping up the table"
- If a participant's team has been eliminated (group stage or knockout), make fun of them for it
- Reference today's fixtures and what's at stake in the sweepstake
- Be specific — mention scores, team names, participant names, and feel free to call some of them cunts
- End with something to watch out for today
- Randomly pick one participant and be genuinely fucking mean about their situation

Return ONLY a JSON array of strings, one string per line of commentary. No preamble, no markdown, no explanation. Example format:
["Line one here.", "Line two here.", "Line three here."]`;

  const response = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    }
  );

  if (response.error) throw new Error(`Anthropic error: ${response.error.message}`);

  const text = response.content.find(b => b.type === 'text')?.text || '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  console.log('Fetching match data…');
  const data = await fetchJson(DATA_URL);
  const matches = data.matches || [];

  const ownerMap = buildOwnerMap();
  const ctx = buildContext(matches, ownerMap);

  console.log(`Recent results: ${ctx.recentResults.length}, Upcoming today: ${ctx.upcomingToday.length}`);

  // Skip API call if nothing has changed
  const fp = fingerprint(ctx);
  if (fp === lastFingerprint()) {
    console.log('No change since last run — skipping API call.');
    return;
  }

  // Also skip if there's nothing interesting to say
  if (!ctx.hasActivity) {
    console.log('No activity in last 48hrs or today — skipping API call.');
    // Write a placeholder so the page still shows something
    const output = {
      lines: ["Quiet day in the sweepstake camp. Check back when the next fixtures kick off."],
      generated: new Date().toISOString(),
      fingerprint: fp,
    };
    fs.writeFileSync(COMMENTARY_PATH, JSON.stringify(output, null, 2));
    return;
  }

  console.log('Calling Anthropic…');
  const lines = await generateCommentary(ctx);

  const output = {
    lines,
    generated: new Date().toISOString(),
    fingerprint: fp,
  };

  fs.writeFileSync(COMMENTARY_PATH, JSON.stringify(output, null, 2));
  console.log(`Done. ${lines.length} lines written to commentary.json`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});