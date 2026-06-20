#!/usr/bin/env node
// generate-commentary.js
// Fetches live World Cup data, builds context, calls Anthropic, writes commentary.json
// Skips the API call if nothing has changed since the last run.

const fs   = require('fs');
const path = require('path');
const https = require('https');

const COMMENTARY_PATH = path.join(__dirname, '..', 'public', 'commentary.json');
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
  return ['Round of 32','Round of 16','Quarter-final','Semi-final','Final'].includes(m.round);
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
  const groupStandings = {}; // group -> { team -> { pts, w, d, l, gf, ga } }

  for (const m of matches) {
    const t1 = canon(m.team1);
    const t2 = canon(m.team2);

    // Group standings
    if (isGroupMatch(m)) {
      const grp = m.group;
      if (!groupStandings[grp]) groupStandings[grp] = {};
      [t1, t2].forEach(t => { if (!groupStandings[grp][t]) groupStandings[grp][t] = { pts:0,w:0,d:0,l:0,gf:0,ga:0 }; });

      if (hasScore(m)) {
        const [s1, s2] = m.score.ft;
        groupStandings[grp][t1].gf += s1; groupStandings[grp][t1].ga += s2;
        groupStandings[grp][t2].gf += s2; groupStandings[grp][t2].ga += s1;
        if (s1 > s2) {
          groupStandings[grp][t1].pts += 3; groupStandings[grp][t1].w++;
          groupStandings[grp][t2].l++;
        } else if (s2 > s1) {
          groupStandings[grp][t2].pts += 3; groupStandings[grp][t2].w++;
          groupStandings[grp][t1].l++;
        } else {
          groupStandings[grp][t1].pts++; groupStandings[grp][t1].d++;
          groupStandings[grp][t2].pts++; groupStandings[grp][t2].d++;
        }

        // Recent results (today or yesterday)
        if (m.date === todayStr || m.date === yesterdayStr) {
          const owners1 = (ownerMap[t1] || []).join(' & ') || '—';
          const owners2 = (ownerMap[t2] || []).join(' & ') || '—';
          recentResults.push(`${t1} (${owners1}) ${s1}–${s2} ${t2} (${owners2}) [${m.group}]`);
        }
      } else if (m.date === todayStr) {
        const owners1 = (ownerMap[t1] || []).join(' & ') || '—';
        const owners2 = (ownerMap[t2] || []).join(' & ') || '—';
        upcomingToday.push(`${t1} (${owners1}) vs ${t2} (${owners2}) [${m.group}]`);
      }
    }

    if (isKnockoutMatch(m)) {
      const skipTbd = name => /^(W\d|L\d|TBD)/.test(name);
      if (skipTbd(m.team1) || skipTbd(m.team2)) continue;

      if (!hasScore(m) && m.date === todayStr) {
        const owners1 = (ownerMap[t1] || []).join(' & ') || '—';
        const owners2 = (ownerMap[t2] || []).join(' & ') || '—';
        upcomingToday.push(`${t1} (${owners1}) vs ${t2} (${owners2}) [${m.round}]`);
      } else if (hasScore(m) && (m.date === todayStr || m.date === yesterdayStr)) {
        const [s1, s2] = m.score.ft;
        const owners1 = (ownerMap[t1] || []).join(' & ') || '—';
        const owners2 = (ownerMap[t2] || []).join(' & ') || '—';
        recentResults.push(`${t1} (${owners1}) ${s1}–${s2} ${t2} (${owners2}) [${m.round}]`);
      }
    }
  }

  // Build standings summary per group (sorted by pts desc)
  const standingLines = [];
  for (const [grp, teams] of Object.entries(groupStandings).sort()) {
    const sorted = Object.entries(teams)
      .sort(([,a],[,b]) => b.pts - a.pts || (b.gf-b.ga) - (a.gf-a.ga));
    const line = sorted.map(([name, s], i) => {
      const owners = (ownerMap[name] || []).join('/') || '—';
      return `  ${i+1}. ${name} (${owners}) ${s.pts}pts ${s.w}W${s.d}D${s.l}L`;
    }).join('\n');
    standingLines.push(`${grp}:\n${line}`);
  }

  // Overall sweepstake standings
  const sweepstakeStandings = PARTICIPANTS.map(p => {
    let pts = 0;
    for (const team of p.teams) {
      for (const grp of Object.values(groupStandings)) {
        if (grp[team]) pts += grp[team].pts;
      }
    }
    return { name: p.name, pts, teams: p.teams };
  }).sort((a,b) => b.pts - a.pts);

  const sweepstakeLines = sweepstakeStandings.map((p, i) =>
    `  ${i+1}. ${p.name} — ${p.pts}pts (${p.teams.join(', ')})`
  ).join('\n');

  return {
    recentResults,
    upcomingToday,
    standingLines,
    sweepstakeLines,
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
  const prompt = `You are a witty, slightly sarky football commentator writing a daily briefing for a World Cup 2026 sweepstake between a group of mates. Keep it punchy, specific, and funny — but not mean.

SWEEPSTAKE PARTICIPANTS AND THEIR TEAMS (group stage points shown):
${ctx.sweepstakeLines}

RECENT RESULTS (last 48hrs):
${ctx.recentResults.length ? ctx.recentResults.join('\n') : 'No recent results yet.'}

TODAY'S UPCOMING FIXTURES:
${ctx.upcomingToday.length ? ctx.upcomingToday.join('\n') : 'No more fixtures today.'}

GROUP STANDINGS (top teams per group):
${ctx.standingLines.join('\n\n')}

Write a briefing of 3–5 punchy lines. Each line should be a self-contained observation or quip. Call out specific participant names and their teams. Reference today's fixtures and what's at stake in the sweepstake. If someone is having a nightmare, say so. If someone's team just got smashed, rub it in gently. End with something to watch out for today.

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