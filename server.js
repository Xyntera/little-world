/**
 * Little Kerala - independent full-stack recreation (UI + API in one app).
 * Serves the game from ./public and the JSON API under /api.
 * Storage: Heroku Postgres when DATABASE_URL is set (durable), otherwise a
 * local JSON file (development only - Heroku dyno disks are ephemeral).
 * No code or data from the original site. Storage starts empty.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ludo = require('./ludo');
const Echo = require('./echo');
const Freeze = require('./freeze');
const Events = require('./events');

const PORT = process.env.PORT || 8787;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DISTRICTS = [
  ['kasaragod', 'Kasaragod', 'കാസർഗോഡ്'], ['kannur', 'Kannur', 'കണ്ണൂർ'],
  ['wayanad', 'Wayanad', 'വയനാട്'], ['kozhikode', 'Kozhikode', 'കോഴിക്കോട്'],
  ['malappuram', 'Malappuram', 'മലപ്പുറം'], ['palakkad', 'Palakkad', 'പാലക്കാട്'],
  ['thrissur', 'Thrissur', 'തൃശ്ശൂർ'], ['ernakulam', 'Ernakulam', 'എറണാകുളം'],
  ['idukki', 'Idukki', 'ഇടുക്കി'], ['kottayam', 'Kottayam', 'കോട്ടയം'],
  ['alappuzha', 'Alappuzha', 'ആലപ്പുഴ'], ['pathanamthitta', 'Pathanamthitta', 'പത്തനംതിട്ട'],
  ['kollam', 'Kollam', 'കൊല്ലം'], ['thiruvananthapuram', 'Thiruvananthapuram', 'തിരുവനന്തപുരം'],
];
const CITIES = [
  ['kerala', 'Little Kerala', 'കേരളം', 'India'], ['mumbai', 'Mumbai', 'मुंबई', 'India'], ['delhi', 'Delhi', 'दिल्ली', 'India'],
  ['dubai', 'Dubai', 'دبي', 'UAE'], ['london', 'London', 'London', 'UK'], ['paris', 'Paris', 'Paris', 'France'],
  ['newyork', 'New York', 'New York', 'USA'], ['tokyo', 'Tokyo', '東京', 'Japan'], ['sydney', 'Sydney', 'Sydney', 'Australia'],
  ['rio', 'Rio de Janeiro', 'Rio', 'Brazil'], ['cairo', 'Cairo', 'القاهرة', 'Egypt'], ['capetown', 'Cape Town', 'Kaapstad', 'South Africa'],
  ['singapore', 'Singapore', 'Singapore', 'Singapore'], ['istanbul', 'Istanbul', 'İstanbul', 'Turkey'],
  ['rome', 'Rome', 'Roma', 'Italy'], ['berlin', 'Berlin', 'Berlin', 'Germany'], ['moscow', 'Moscow', 'Москва', 'Russia'], ['beijing', 'Beijing', '北京', 'China'],
  ['seoul', 'Seoul', '서울', 'South Korea'], ['bangkok', 'Bangkok', 'กรุงเทพฯ', 'Thailand'], ['hongkong', 'Hong Kong', '香港', 'Hong Kong'], ['losangeles', 'Los Angeles', 'Los Angeles', 'USA'],
  ['mexicocity', 'Mexico City', 'Ciudad de México', 'Mexico'], ['buenosaires', 'Buenos Aires', 'Buenos Aires', 'Argentina'], ['toronto', 'Toronto', 'Toronto', 'Canada'], ['athens', 'Athens', 'Αθήνα', 'Greece'],
  ['nairobi', 'Nairobi', 'Nairobi', 'Kenya'], ['jakarta', 'Jakarta', 'Jakarta', 'Indonesia'],
  ['lisbon', 'Lisbon', 'Lisboa', 'Portugal'], ['amsterdam', 'Amsterdam', 'Amsterdam', 'Netherlands'],
  ['madrid', 'Madrid', 'Madrid', 'Spain'], ['marrakesh', 'Marrakesh', 'Marrakech', 'Morocco'], ['lima', 'Lima', 'Lima', 'Peru'],
  ['bogota', 'Bogotá', 'Bogotá', 'Colombia'], ['bogotadowntown', 'Bogotá - La Candelaria', 'La Candelaria', 'Colombia', 'bogota', '2.3km SW of Monserrate'], /* Update 123: anchored district; parent + note make the relationship explicit in the travel UI */
  ['auckland', 'Auckland', 'Tāmaki Makaurau', 'New Zealand'],
  ['lagos', 'Lagos', 'Èkó', 'Nigeria'], ['lagosisland', 'Lagos - Lagos Island', 'Lagos Island', 'Nigeria', 'lagos', '5.3km N of the lighthouse'], /* Update 124: anchored district of lagos (123 mechanism); note = real offset Beecroft Point lighthouse (6.403278,3.383833) -> Cathedral Church of Christ (6.4508,3.3902): 5.25km N + 0.70km E */
  ['stockholm', 'Stockholm', 'Stockholm', 'Sweden'],
  ['kualalumpur', 'Kuala Lumpur', 'Kuala Lumpur', 'Malaysia'],
];
if (process.env.DEV_PRAGUE) CITIES.push(['prague', 'Prague', 'Praha', 'Czechia']); /* Update 167: LOCAL-DEV opt-in registration only - production never sets DEV_PRAGUE (Main 6:13: env-gated, never default) */
const CITY_GOAL = 500; // shared goal: points collected together in a city
const EMOTES = ['wave', 'laugh', 'dance', 'party', 'heart', 'clap', 'bow', 'bhangra', 'disco', 'robot', 'spin', 'moonwalk', 'garba', 'kathak', 'salsa', 'breakdance', 'ballet', 'hula', 'jump', 'sit'];
const EMOTE_MS = { dance: 8000, party: 8000, bhangra: 8000, disco: 8000, robot: 8000, spin: 8000, moonwalk: 8000, garba: 8000, kathak: 8000, salsa: 8000, breakdance: 8000, ballet: 8000, hula: 8000, jump: 6000, sit: 600000 }; // how long others see a move; short gestures stay 4 s
const eventsDb = new Map(); // stage shows, in memory + write-through to the existing DB (see events.js)
// durability truth: eventsDirty is set by ANY failed event write and cleared ONLY by a full
// reconcile that re-syncs every show, signup and queued deletion from memory - one show left
// unsaved keeps durable:false no matter how many unrelated writes later succeed.
let eventsDirty = false;
const pendingEventDeletes = []; // id batches whose delete write failed; retried by reconcile, capped
let reconcileTimer = null, reconcileStep = 0;
const eventWrite = Events.serialWriter(err => {
  eventsDirty = true; console.error('event persist failed:', err.message); scheduleEventReconcile();
});
async function reconcileEvents() {
  await Events.reconcileShows(eventsDb, store, pendingEventDeletes);
  eventsDirty = false; reconcileStep = 0;
}
function scheduleEventReconcile() {
  if (reconcileTimer) return;
  const delay = [5000, 30000, 120000][Math.min(reconcileStep++, 2)]; // prompt bounded retries; the 60s sweep below is the standing net
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    eventWrite(reconcileEvents).catch(() => { if (eventsDirty && reconcileStep < 3) scheduleEventReconcile(); });
  }, delay);
  reconcileTimer.unref();
}
const emotes = new Map(); // playerId -> { e, t }
const ITEMS = { flower: 5, mango: 10, jackfruit: 15, umbrella: 25, banana: 100 };
const JOIN_BONUS = 15;
const PRESENCE_TTL_MS = 60 * 1000;
const PV_CLAIM_TTL_MS = 14 * 1000;
const pvClaims = new Map();
const cityBalls = new Map(); // 118v/w beach-ball relay: city -> Map(ballId -> {x,z,vx,vz,pid,tab,t}); in-memory only, same durability class as pvClaims
const voiceDrops = new Map(); // pid -> time: dropped from voice because the destination city room was full

/* ---------------- storage: postgres or json file ---------------- */

let store = null; // { async getPlayer(id), putPlayer(p), bumpDistrict(id, playersDelta, pointsDelta), allPlayers(), districtRows(), ping(id) }

async function initPostgres(databaseUrl) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    max: 5,
  });
  // an error on an idle pool client (dropped connection, database restart) must not crash the server
  pool.on('error', err => console.error('postgres idle client error:', err.message));
  await pool.query(`CREATE TABLE IF NOT EXISTS players (
      id text primary key, token text not null, name text not null,
      district text not null, points integer not null default 0,
      look jsonb not null default '{}', auth text not null default 'guest',
      joined_at timestamptz not null default now(), last_seen bigint not null default 0, pos jsonb not null default '{}')`)
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS pos jsonb not null default '{}'`);;
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS city text not null default 'kerala'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS city_stats (id text primary key, points bigint not null default 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ludo_games (id text primary key, data jsonb not null, updated_at bigint not null)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS voice_reports (id serial primary key, reporter text not null, target text not null, room text not null, reason text not null, at bigint not null)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS districts (
      id text primary key, points integer not null default 0, players integer not null default 0)`);
  // stage shows + signups: approved durable scope - existing DB only, rows deleted 10 minutes after
  // a show ends or is cancelled (same keepEndedMs the in-memory sweep uses), host has 3 minutes to
  // reconnect after a restart (enforced by the sweep's bootAt grace, not by these tables).
  await pool.query(`CREATE TABLE IF NOT EXISTS event_shows (
      id text primary key, city text not null, kind text not null, title text not null,
      starts_at bigint not null, ends_at bigint not null,
      host_id text not null, host_name text not null,
      cancelled boolean not null default false, cancelled_at bigint, cancel_reason text,
      created_at bigint not null)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS event_signups (
      show_id text not null, player_id text not null, role text not null, name text not null,
      primary key (show_id, player_id))`);
  return {
    kind: 'postgres',
    showStore: true,
    async saveShow(e) {
      const r = Events.showRow(e);
      await pool.query(`INSERT INTO event_shows (id, city, kind, title, starts_at, ends_at, host_id, host_name, cancelled, cancelled_at, cancel_reason, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET cancelled=$9, cancelled_at=$10, cancel_reason=$11`,
        [r.id, r.city, r.kind, r.title, r.starts_at, r.ends_at, r.host_id, r.host_name, r.cancelled, r.cancelled_at, r.cancel_reason, r.created_at]);
    },
    async saveSignup(showId, playerId, role, name) {
      await pool.query(`INSERT INTO event_signups (show_id, player_id, role, name) VALUES ($1,$2,$3,$4)
        ON CONFLICT (show_id, player_id) DO UPDATE SET role=$3, name=$4`, [showId, playerId, role, name]);
    },
    async removeSignup(showId, playerId) { await pool.query('DELETE FROM event_signups WHERE show_id=$1 AND player_id=$2', [showId, playerId]); },
    async syncSignups(showId, memberIds) { await pool.query('DELETE FROM event_signups WHERE show_id=$1 AND NOT (player_id = ANY($2::text[]))', [showId, memberIds]); },
    async deleteShows(ids) {
      if (!ids.length) return;
      await pool.query('DELETE FROM event_signups WHERE show_id = ANY($1::text[])', [ids]);
      await pool.query('DELETE FROM event_shows WHERE id = ANY($1::text[])', [ids]);
    },
    async purgeShows(cutoff) {
      await pool.query('DELETE FROM event_signups WHERE show_id IN (SELECT id FROM event_shows WHERE LEAST(ends_at, COALESCE(cancelled_at, ends_at)) < $1)', [cutoff]);
      const r = await pool.query('DELETE FROM event_shows WHERE LEAST(ends_at, COALESCE(cancelled_at, ends_at)) < $1', [cutoff]);
      return r.rowCount;
    },
    async loadShows() {
      const shows = (await pool.query('SELECT * FROM event_shows')).rows;
      const signups = (await pool.query('SELECT * FROM event_signups')).rows;
      const byShow = {}; for (const s of signups) (byShow[s.show_id] = byShow[s.show_id] || []).push(s);
      return shows.map(row => ({ show: row, signups: byShow[row.id] || [] }));
    },
    async getPlayer(id) {
      const r = await pool.query('SELECT id, token, name, district, city, points, look, auth, pos, joined_at AS "joinedAt", last_seen AS "lastSeen" FROM players WHERE id=$1', [id]);
      return r.rows[0] || null;
    },
    async putPlayer(p) {
      await pool.query(`INSERT INTO players (id, token, name, district, points, look, auth, joined_at, last_seen, pos, city)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET name=$3, district=$4, look=$6, last_seen=$9, pos=$10, city=$11`, /* points deliberately NOT overwritten: only addPoints/payLudo change them, atomically */
        [p.id, p.token, p.name, p.district, p.points, p.look, p.auth, p.joinedAt, p.lastSeen, p.pos || {}, p.city || 'kerala']);
    },
    async setToken(id, hashed, expectedOld) { await pool.query('UPDATE players SET token=$2 WHERE id=$1 AND token=$3', [id, hashed, expectedOld]); },
    async addPoints(id, delta) {
      const r = await pool.query('UPDATE players SET points = points + $2 WHERE id=$1 RETURNING points', [id, delta]);
      return r.rows[0] ? Number(r.rows[0].points) : null;
    },
    async bumpDistrict(id, playersDelta, pointsDelta) {
      await pool.query(`INSERT INTO districts (id, points, players) VALUES ($1,$3,$2)
        ON CONFLICT (id) DO UPDATE SET points = districts.points + $3, players = districts.players + $2`,
        [id, playersDelta, pointsDelta]);
    },
    async allPlayers() {
      const r = await pool.query('SELECT id,name,district,city,points,look,auth,pos,joined_at AS "joinedAt",last_seen AS "lastSeen" FROM players ORDER BY points DESC LIMIT 50');
      return r.rows;
    },
    async districtRows() {
      const r = await pool.query('SELECT * FROM districts');
      return r.rows;
    },
    async activeCityCounts(since) {
      const r = await pool.query(`SELECT COALESCE(city, 'kerala') AS city, COUNT(*)::int AS n FROM players WHERE last_seen > $1 GROUP BY 1`, [since]);
      const out = {}; for (const row of r.rows) out[row.city] = row.n; return out;
    },
    async activePlayersInCity(since, city, limit, origin) {
      if (origin) {
        const r = await pool.query(`SELECT id,name,district,city,points,look,pos,last_seen AS "lastSeen" FROM players
          WHERE last_seen > $1 AND COALESCE(city, 'kerala') = $2
          AND jsonb_typeof(pos->'x') = 'number' AND jsonb_typeof(pos->'z') = 'number'
          ORDER BY power((pos->>'x')::double precision - $4, 2) + power((pos->>'z')::double precision - $5, 2), id
          LIMIT $3`, [since, city, limit || 60, origin.x, origin.z]);
        return r.rows;
      }
      const r = await pool.query('SELECT id,name,district,city,points,look,pos,last_seen AS "lastSeen" FROM players WHERE last_seen > $1 AND COALESCE(city, \'kerala\') = $2 ORDER BY last_seen DESC LIMIT $3', [since, city, limit || 60]);
      return r.rows;
    },
    async activePlayersByIds(ids) {
      if (!ids.length) return [];
      const r = await pool.query('SELECT id, city, pos, last_seen AS "lastSeen" FROM players WHERE id = ANY($1::text[])', [ids]);
      return r.rows;
    },
    async bumpCity(id, delta) {
      await pool.query(`INSERT INTO city_stats (id, points) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET points = city_stats.points + $2`, [id, delta]);
    },
    async payLudo(g, playerId, value, district, city) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query('INSERT INTO ludo_games (id, data, updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [g.id, JSON.stringify(Object.assign({}, g, { rewarded: false })), Date.now()]);
        const r = await c.query('SELECT data FROM ludo_games WHERE id=$1 FOR UPDATE', [g.id]);
        if (r.rows[0] && r.rows[0].data.rewarded) { await c.query('ROLLBACK'); return false; }
        await c.query('UPDATE players SET points = points + $2 WHERE id=$1', [playerId, value]);
        if (district !== 'none') await c.query(`INSERT INTO districts (id, points, players) VALUES ($1,$2,0) ON CONFLICT (id) DO UPDATE SET points = districts.points + $2`, [district, value]);
        await c.query(`INSERT INTO city_stats (id, points) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET points = city_stats.points + $2`, [city, value]);
        await c.query('UPDATE ludo_games SET data=$2, updated_at=$3 WHERE id=$1', [g.id, JSON.stringify(g), Date.now()]);
        await c.query('COMMIT');
        return true;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    async addReport(r) { await pool.query('INSERT INTO voice_reports (reporter, target, room, reason, at) VALUES ($1,$2,$3,$4,$5)', [r.reporter, r.target, r.room, r.reason, r.at]); },
    async saveGame(g) { await pool.query('INSERT INTO ludo_games (id, data, updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET data=$2, updated_at=$3', [g.id, JSON.stringify(g), Date.now()]); },
    async deleteGame(id) { await pool.query('DELETE FROM ludo_games WHERE id=$1', [id]); },
    async loadGames() { const r = await pool.query('SELECT data FROM ludo_games WHERE updated_at > $1', [Date.now() - 60 * 60000]); return r.rows.map(x => x.data); },
    async cityRows() {
      const r = await pool.query('SELECT id, points FROM city_stats');
      return r.rows.map(x => ({ id: x.id, points: Number(x.points) }));
    },
  };
}

function initJson(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = null; }
  if (!data || !data.players || !data.districts) data = { players: {}, districts: {} };
  const save = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };
  return {
    kind: 'json-file (development only - not durable on Heroku)',
    async getPlayer(id) { return data.players[id] || null; },
    async putPlayer(p) { const old = data.players[p.id]; data.players[p.id] = old ? Object.assign({}, p, { points: old.points }) : p; save(); },
    async setToken(id, hashed, expectedOld) { const p = data.players[id]; if (p && p.token === expectedOld) { p.token = hashed; save(); } },
    async addPoints(id, delta) { const p = data.players[id]; if (!p) return null; p.points = Number(p.points) + delta; save(); return p.points; },
    async bumpDistrict(id, playersDelta, pointsDelta) {
      if (!data.districts[id]) data.districts[id] = { id, points: 0, players: 0 };
      data.districts[id].players += playersDelta;
      data.districts[id].points += pointsDelta;
      save();
    },
    async allPlayers() {
      return Object.values(data.players).sort((a, b) => b.points - a.points).slice(0, 50);
    },
    async districtRows() { return Object.values(data.districts); },
    async activeCityCounts(since) { const out = {}; for (const p of Object.values(data.players)) if (Number(p.lastSeen) > since) { const c = p.city || 'kerala'; out[c] = (out[c] || 0) + 1; } return out; },
    async activePlayersInCity(since, city, limit, origin) {
      let rows = Object.values(data.players).filter(p => Number(p.lastSeen) > since && (p.city || 'kerala') === city);
      if (origin) rows = rows.filter(p => p.pos && Number.isFinite(p.pos.x) && Number.isFinite(p.pos.z)).sort((a,b) => ((a.pos.x-origin.x)**2+(a.pos.z-origin.z)**2)-((b.pos.x-origin.x)**2+(b.pos.z-origin.z)**2) || a.id.localeCompare(b.id));
      return rows.slice(0, limit || 60);
    },
    async activePlayersByIds(ids) { const set = new Set(ids); return Object.values(data.players).filter(p => set.has(p.id)); },
    async bumpCity(id, delta) { data.cities = data.cities || {}; data.cities[id] = (data.cities[id] || 0) + delta; save(); },
    async payLudo(g, playerId, value, district, city) {
      const p = data.players[playerId]; if (!p) return false;
      p.points = Number(p.points) + value;
      if (district !== 'none') { if (!data.districts[district]) data.districts[district] = { id: district, points: 0, players: 0 }; data.districts[district].points += value; }
      data.cities = data.cities || {}; data.cities[city] = (data.cities[city] || 0) + value;
      save(); return true;
    },
    async addReport(r) { data.reports = data.reports || []; data.reports.push(r); save(); },
    async saveGame() {}, async deleteGame() {}, async loadGames() { return []; },
    // stage shows stay in-memory on the dev store: no showStore flag, so the API reports durable: false
    async saveShow() {}, async saveSignup() {}, async removeSignup() {}, async syncSignups() {}, async deleteShows() {}, async purgeShows() { return 0; }, async loadShows() { return []; },
    async cityRows() { return Object.entries(data.cities || {}).map(([id, points]) => ({ id, points })); },
  };
}


/* ---- Ludo (in-memory, resets when the server restarts) ---- */
const ludoGames = new Map(), playerGame = new Map();
const echoGames = new Map(), playerEcho = new Map(); // Echo Dance: in-memory only (games last minutes; nothing saved)
const freezeGames = new Map(), playerFreeze = new Map(); // Freeze Beat: same in-memory lifetime rules
const LUDO_WIN_HUMAN = 25, LUDO_WIN_COMPUTER = 10;
const gameKey = g => [g.rev, g.status, g.turn, g.phase, g.turnAt, g.botAt, g.rewarded, g.players[1] && g.players[1].pid].join('|');
async function persistGame(g) {
  const k = gameKey(g);
  if (g._k === k) return;
  g._k = k;
  try { await store.saveGame(g); } catch (e) { console.error('ludo save failed', e.message); }
}
async function loadLudo() {
  try {
    for (const g of await store.loadGames()) {
      ludoGames.set(g.id, g);
      for (const p of g.players) if (p && !p.bot && g.status !== 'finished') playerGame.set(p.pid, g.id);
      if (g.status === 'finished') for (const p of g.players) if (p && !p.bot && !playerGame.has(p.pid)) playerGame.set(p.pid, g.id);
    }
    console.log('ludo games restored:', ludoGames.size);
  } catch (e) { console.error('ludo load failed', e.message); }
}

async function loadEvents() {
  try {
    const now = Date.now(), cut = now - Events.LIMITS.keepEndedMs, rows = await store.loadShows();
    let restored = 0;
    for (const { show, signups } of rows) {
      if (Math.min(+show.ends_at, show.cancelled_at != null ? +show.cancelled_at : +show.ends_at) <= cut) continue; // past the 10-minute keep window; purged below
      const e = Events.fromRow(show, signups);
      eventsDb.set(e.id, e); restored++;
    }
    await store.purgeShows(cut); // retention: delete rows 10 minutes after end/cancel
    if (restored) console.log('events: restored', restored, 'show(s) from', store.kind);
  } catch (err) { console.error('events restore failed (shows run in-memory only):', err.message); }
}
function sweepGames(now) {
  for (const [id, g] of ludoGames) {
    const old = g.status === 'finished' ? now - g.turnAt > 10 * 60000 : g.status === 'waiting' ? now - g.created > Ludo.WAIT_MS : now - g.turnAt > 30 * 60000;
    if (old) { ludoGames.delete(id); store.deleteGame(id).catch(() => {}); for (const p of g.players) if (p && playerGame.get(p.pid) === id) playerGame.delete(p.pid); }
  }
}
const paying = new Set();
async function ludoReward(g, player) {
  if (!g || g.status !== 'finished' || g.rewarded || paying.has(g.id)) return;
  paying.add(g.id);
  try {
    const w = g.players[g.winner];
    if (!w || w.bot) { g.rewarded = true; await persistGame(g); return; }
    const winner = w.pid === player.id ? player : await store.getPlayer(w.pid);
    if (!winner) { g.rewarded = true; await persistGame(g); return; }
    const value = g.players.some(p => p && p.bot) ? LUDO_WIN_COMPUTER : LUDO_WIN_HUMAN;
    // paid marker and points credit commit together (one DB transaction on Postgres)
    const done = Object.assign({}, g, { rewarded: true, reward: { pid: w.pid, points: value } });
    delete done._k;
    const paid = await store.payLudo(done, winner.id, value, winner.district, winner.city || 'kerala');
    g.rewarded = true; g.reward = done.reward; g._k = null;
  } finally { paying.delete(g.id); }
}


/* ---- Voice rooms (signalling only; audio is peer-to-peer WebRTC, nothing recorded) ---- */
const VOICE_ENABLED = process.env.VOICE_ENABLED === '1';
// Mesh cost grows per member: every client connects to every other client, so each extra member
// is one more audio upload and one more decoder on every device, and every join bursts SDP+ICE
// signals against the 40 signals/s rate limit. 8 doubles the room while staying phone-friendly.
// A bigger city crowd needs a proximity subset or a media server, not a bigger mesh.
const VOICE_MAX = Math.max(2, Math.min(50, Number(process.env.VOICE_MAX) || 50)), VOICE_TTL = 15000; // room size cap; each member still hears only their VOICE_HEAR nearest
const VOICE_HEAR = Math.max(1, Math.min(12, Number(process.env.VOICE_HEAR) || 6)); // how many nearest voices a member hears
const VOICE_INBOUND = Math.max(VOICE_HEAR, Math.min(24, Number(process.env.VOICE_INBOUND) || 12)); // cap on total connections per member so a dense pile can't force unbounded uploads

// ---- abuse limits (in-memory, per dyno; generous for real play) ----
const collectRate = new Map(), joinRate = new Map();
// ping write-amplification protection: every allowed ping is a store read + write, so bound them.
// Two layers: pre-auth per-IP (bounds total ping traffic incl. invalid tokens, no ID lookup so no
// auth oracle), post-auth per-player (a caller must hold the player's token to touch that bucket,
// so an unauthenticated caller cannot exhaust a KNOWN player's quota). Residual risks, accepted:
// - one hostile user on a shared NAT can exhaust the whole network's IP bucket with tokenless
//   invalid requests (no tokens needed) and 429 everyone behind it until the window slides;
// - below the IP ceiling, invalid-token pings still cost one getPlayer SELECT each;
// - a >MAX_KEYS fresh-key flood (distinct router-set IPs) evicts legit IP buckets fail-open.
// hit() lives in ratelimit.js with a hard memory bound; each protection has its OWN map, so a
// flood on one bucket family cannot evict another family's entries.
const pingIpRate = new Map(), pingPlayerRate = new Map();
const PING_RL_WIN = Number(process.env.PING_RL_WIN) || 10000, PING_RL_PLAYER = Math.max(5, Number(process.env.PING_RL_PLAYER) || 45), PING_RL_IP = Math.max(20, Number(process.env.PING_RL_IP) || 1000);
const { hit } = require('./ratelimit');
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim();

// ---- server-owned pickup supply: the server decides what each slot is worth ----
const ITEM_WEIGHTS = [['flower', .42], ['mango', .3], ['jackfruit', .16], ['umbrella', .09], ['banana', .03]];
const pickupSlots = new Map(); // playerId -> { city, slots: [{ id, item, spot, jx, jz, ready }] }
const legacyPlayers = new Map();
const SLOT_COUNT = 40, LEGACY_MODE = process.env.LEGACY_COLLECT || 'full'; // full = existing behaviour (default until a communicated transition). flat: old clients still score but only LEGACY_FLAT points, whatever item they claim; off: 410; full: old behaviour (never default)
const LEGACY_FLAT = 5
function rollItem() { let r = Math.random(), t = ITEM_WEIGHTS.reduce((a, b) => a + b[1], 0); r *= t; for (const [n, w] of ITEM_WEIGHTS) { r -= w; if (r <= 0) return n; } return 'flower'; }
// Tokens at rest: "h:<sha256>" (hashed) or the legacy plaintext. Verification accepts both; HASH_TOKENS=1 makes new joins
// hashed and upgrades legacy rows one by one when their owner next authenticates (no bulk migration, nothing becomes unrecoverable for the user).
const HASH_TOKENS = process.env.HASH_TOKENS === '1';
const hashToken = t => 'h:' + crypto.createHash('sha256').update(String(t)).digest('hex');
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function checkToken(stored, header) {
  const h = String(header || ''); if (!h.startsWith('Bearer ')) return null;
  const given = h.slice(7);
  if (String(stored).startsWith('h:')) return safeEq(hashToken(given), stored) ? 'hashed' : null;
  return safeEq(given, stored) ? 'legacy' : null;
}
const SPOTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'spots.json'), 'utf8')); } catch { return {}; } })();
const PICK_RADIUS = 4.5, MAX_SPEED = 24, SPEED_SLACK = 12; // world units, units/second (car = 15)
const tracks = new Map(); // playerId -> { x, z, t, city } last accepted position
// Pickup spots never land on a stage platform or its ramp: collecting there collides with shows
// (vehicles already refuse the stage). Audience court and open ground stay collectible. Slots are
// in-memory and reference spots by index, so filter once at boot (indices stay stable per process).
const spotsFiltered = new Map();
function spotsOf(city) {
  let f = spotsFiltered.get(city); if (f) return f;
  const all = SPOTS[city] || [], st = (Events.STAGES || {})[city];
  f = !st ? all : all.filter(p => {
    const onPlat = Math.abs(p[0] - st.x) < st.w / 2 + .5 && Math.abs(p[1] - st.z) < st.d / 2 + .5;
    const rz = p[1] - (st.z + st.d / 2), onRamp = Math.abs(p[0] - st.x) < 3 && rz >= 0 && rz <= (st.ramp || 3) + .5;
    return !onPlat && !onRamp;
  });
  spotsFiltered.set(city, f); return f;
}
function newSlot(id, now, delayMs, city, taken) {
  const n = spotsOf(city).length; let spot = Math.floor(Math.random() * n);
  if (taken && taken.has(spot)) { // never assign a taken spot: pick uniformly among the free ones
    const free = [];
    for (let i = 0; i < n; i++) if (!taken.has(i)) free.push(i);
    if (free.length) spot = free[Math.floor(Math.random() * free.length)];
  }
  return { id, item: rollItem(), spot, ready: now + delayMs };
}
function slotView(sl, city) { const p = spotsOf(city)[sl.spot] || [0, 0]; return { id: sl.id, item: sl.item, points: ITEMS[sl.item], spot: sl.spot, x: p[0], z: p[1] }; }
function slotsFor(pid, city, now) {
  let e = pickupSlots.get(pid);
  if (!e) { e = { byCity: {}, touched: now }; pickupSlots.set(pid, e); }
  e.touched = now;
  if (!e.byCity[city]) {
    const taken = new Set(), count = Math.min(SLOT_COUNT, spotsOf(city).length), arr = [];
    for (let i = 0; i < count; i++) { const sl = newSlot(i, now, 0, city, taken); taken.add(sl.spot); arr.push(sl); }
    e.byCity[city] = arr; // kept per city, so switching city cannot refresh cooldowns
  }
  if (pickupSlots.size > 5000) for (const [k, v] of pickupSlots) if (v.touched < now - 3600000) { pickupSlots.delete(k); tracks.delete(k); }
  return e.byCity[city];
}
// position claims come from the client. Reject jumps faster than anyone can move; keep the last accepted point.
function trackPos(pid, city, x, z, now) {
  const t = tracks.get(pid);
  if (!t || t.city !== city) { tracks.set(pid, { x, z, t: now, city }); return t ? 'moved-city' : 'first'; }
  const dt = Math.min(60, Math.max(0, (now - t.t) / 1000));
  if (Math.hypot(x - t.x, z - t.z) > MAX_SPEED * dt + SPEED_SLACK) return 'too-fast';
  t.x = x; t.z = z; t.t = now; return 'ok';
}
let legacyCollects = 0; const rejects = { near: 0, fast: 0, ping: 0 };
let voiceDiagN = 0;
const voiceRooms = new Map(), voiceOf = new Map(), voiceRate = new Map();
function voiceSweep(now) {
  for (const [room, m] of voiceRooms) {
    for (const [pid, v] of m) if (now - v.last > VOICE_TTL) { m.delete(pid); voiceOf.delete(pid); }
    if (!m.size) voiceRooms.delete(room);
  }
}
function voiceLeave(pid) {
  const room = voiceOf.get(pid); voiceOf.delete(pid);
  const m = room && voiceRooms.get(room); if (m) { m.delete(pid); if (!m.size) voiceRooms.delete(room); }
}
// one symmetric connect graph per room per view: an edge exists when either member hears the other.
// Degree is capped (VOICE_INBOUND) so a dense pile can't force unbounded uploads: a member's own hear edges are always
// kept; excess inbound edges drop the best-connected (then farthest) hearer first, so sparse neighbours keep theirs.
// A trimmed edge disappears from BOTH views within a poll, so no required hear edge silently dies one-sided.
function voiceGraph(m, cityId) {
  const ids = [...m.keys()];
  const posOf = id => { const t = tracks.get(id); return t && t.city === cityId && isFinite(t.x) && isFinite(t.z) ? { x: t.x, z: t.z } : null; };
  const dist = (a, b) => { const pa = posOf(a), pb = posOf(b); return pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z) : 1e9; };
  // distance ties (dense piles) break on a per-hearer pair hash, not insertion order: spreads wanted-hear across the
  // pile so the degree cap is shared instead of stranding late joiners; deterministic per poll (no flapping).
  const tie = (a, b) => { const s = a + ':' + b; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16; return h; }; // avalanche mix so numeric id suffixes don't correlate rankings
  const hear = new Map();
  for (const id of ids) hear.set(id, ids.filter(o => o !== id).sort((a, b) => dist(id, a) - dist(id, b) || tie(id, a) - tie(id, b)).slice(0, VOICE_HEAR));
  const deg = new Map(ids.map(id => [id, new Set(hear.get(id))]));
  for (const a of ids) for (const b of hear.get(a)) deg.get(b).add(a);
  for (const id of ids) {
    const s = deg.get(id);
    if (s.size <= VOICE_INBOUND) continue;
    const inb = [...s].filter(d => hear.get(id).indexOf(d) < 0).sort((x, y) => deg.get(y).size - deg.get(x).size || dist(id, y) - dist(id, x));
    for (const d of inb) { if (s.size <= VOICE_INBOUND) break; s.delete(d); deg.get(d).delete(id); }
  }
  return { hear, deg, posOf };
}
function voiceView(room, pid) {
  const m = voiceRooms.get(room) || new Map();
  const members = [...m].map(([id, v]) => ({ id, name: v.name, listenOnly: v.listenOnly }));
  // proximity hearing (approved design 2026-10-25): a member hears their VOICE_HEAR nearest roommates, spatially mixed by the client.
  // positions come from trackPos (client pings); positionless members rank far. Only hear-set positions are returned.
  const g = voiceGraph(m, room.slice(5));
  const conn = g.deg.get(pid) || new Set();
  const hear = (g.hear.get(pid) || []).filter(id => conn.has(id)); // audible = wanted AND connected
  const inbound = [...conn].filter(id => hear.indexOf(id) < 0);
  const pos = {}; for (const id of hear) { const p = g.posOf(id); if (p) pos[id] = [+p.x.toFixed(1), +p.z.toFixed(1)]; }
  return { room, max: VOICE_MAX, hearMax: VOICE_HEAR, members, hear, inbound, pos, me: pid };
}

/* ---------------- helpers ---------------- */

const districtKey = id => (DISTRICTS.find(d => d[0] === id) || [null])[0];

/* look: allowlist of small integers (live data holds exactly preset/skin/hair/hairColor). A field is only changed by a valid in-range
   integer (number or digit string); anything else (negative, NaN, float, object, out of range) is ignored and the current choice is kept, never clamped to a different style. */
const LOOK_MAX = { preset: 7, skin: 7, hair: 7, hairColor: 3, outfit: 14, outfitVar: 2 };
const LOOK_DEFAULT = { preset: 0, skin: 3, hair: 0, hairColor: 0 };
function cleanLook(raw, base) {
  const out = {};
  const keep = base && typeof base === 'object' ? base : {};
  for (const k of Object.keys(LOOK_MAX)) {
    const v = keep[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LOOK_MAX[k]) out[k] = v; else if (k in LOOK_DEFAULT) out[k] = LOOK_DEFAULT[k];
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const k of Object.keys(LOOK_MAX)) {
    const v = raw[k];
    const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,2}$/.test(v) ? Number(v) : NaN);
    if (Number.isInteger(n) && n >= 0 && n <= LOOK_MAX[k]) out[k] = n;
  }
  return out;
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, district: p.district, city: p.city || 'kerala', points: Number(p.points), look: p.look, auth: p.auth, joinedAt: p.joinedAt };
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }, headers || {}));
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 65536) reject(new Error('body too large')); });
    req.on('end', () => { if (!buf) return resolve({}); try { resolve(JSON.parse(buf)); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { send(res, 403, { error: 'forbidden' }); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { send(res, 404, { error: 'not found' }); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': /\.(js|html|css)$|\/$/.test(file) ? 'no-cache' : 'public, max-age=3600' });
    res.end(buf);
  });
}

/* ---------------- routes ---------------- */

async function handleApi(req, res, url, parts) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'POST' && url.pathname === '/api/join') {
    if (!hit(joinRate, clientIp(req), Date.now(), 3600000, 60)) return send(res, 429, { error: 'too many new players from this network, try again later' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 24);
    const district = body.district === 'none' ? 'none' : districtKey(String(body.district || ''));
    if (!name) return send(res, 400, { error: 'name is required' });
    if (!district) return send(res, 400, { error: 'unknown district' });
    if (body.adult !== true) return send(res, 400, { error: 'adult confirmation required' });
    const rawToken = crypto.randomBytes(24).toString('hex');
    const player = {
      id: 'p_' + crypto.randomBytes(9).toString('hex'),
      token: HASH_TOKENS ? hashToken(rawToken) : rawToken,
      name, district, points: JOIN_BONUS,
      look: cleanLook(body.look),
      auth: 'guest', joinedAt: new Date().toISOString(), lastSeen: Date.now(),
    };
    await store.putPlayer(player);
    if (district !== 'none') await store.bumpDistrict(district, 1, JOIN_BONUS);
    return send(res, 201, { player: publicPlayer(player), token: rawToken, joinBonus: JOIN_BONUS });
  }

  if (req.method === 'GET' && url.pathname === '/api/districts') {
    return send(res, 200, { districts: DISTRICTS.map(([id, en, ml]) => ({ id, name: en, malayalam: ml })) });
  }
  if (req.method === 'GET' && url.pathname === '/api/items') {
    return send(res, 200, { items: Object.entries(ITEMS).map(([name, points]) => ({ name, points })) });
  }

  if (parts[1] === 'players' && parts[2]) {
    if (req.method === 'POST' && parts[3] === 'ping' && !hit(pingIpRate, clientIp(req), Date.now(), PING_RL_WIN, PING_RL_IP)) return send(res, 429, { error: 'too many requests from this network' });
    const player = await store.getPlayer(parts[2]);
    if (!player) return send(res, 404, { error: 'player not found' });
    const action = parts[3] || '';
    if (req.method === 'GET' && !action) return send(res, 200, { player: publicPlayer(player) });
    const authRes = checkToken(player.token, req.headers.authorization);
    if (!authRes) return send(res, 401, { error: 'missing or invalid bearer token' });
    if (HASH_TOKENS && authRes === 'legacy') { const h = hashToken(String(req.headers.authorization).slice(7)); await store.setToken(player.id, h, player.token); player.token = h; }

    if (action === 'voice') {
      if (!VOICE_ENABLED) return send(res, 404, { error: 'voice is not enabled' });
      const sub = parts[4] || '', now = Date.now();
      voiceSweep(now);
      const room = 'city:' + (player.city || 'kerala');
      if (sub === 'join' && req.method === 'POST') {
        const body = await readBody(req);
        if (voiceOf.get(player.id) && voiceOf.get(player.id) !== room) voiceLeave(player.id);
        let m = voiceRooms.get(room); if (!m) { m = new Map(); voiceRooms.set(room, m); }
        if (!m.has(player.id) && m.size >= VOICE_MAX) return send(res, 409, { error: 'voice room is full (max ' + VOICE_MAX + ')' });
        m.set(player.id, { name: player.name, last: now, queue: [], listenOnly: !!body.listenOnly });
        voiceOf.set(player.id, room); voiceDrops.delete(player.id);
        return send(res, 200, voiceView(room, player.id));
      }
      const mine = voiceOf.get(player.id), mm = mine && voiceRooms.get(mine), me = mm && mm.get(player.id);
      if (sub === 'leave' && req.method === 'POST') { voiceLeave(player.id); return send(res, 200, { ok: true }); }
      if (!me) { const df = voiceDrops.get(player.id); if (df && now - df < 60000) return send(res, 409, { error: "that city's voice room is full (max " + VOICE_MAX + ") - tap Voice to try again" }); return send(res, 409, { error: 'not in a voice room' }); }
      me.last = now;
      if (sub === '' && req.method === 'GET') {
        const signals = me.queue.splice(0, me.queue.length);
        return send(res, 200, Object.assign(voiceView(mine, player.id), { signals }));
      }
      if (sub === 'signal' && req.method === 'POST') {
        const body = await readBody(req);
        const r = voiceRate.get(player.id) || { t: now, n: 0 };
        if (now - r.t > 1000) { r.t = now; r.n = 0; } r.n++; voiceRate.set(player.id, r);
        if (r.n > 40) return send(res, 429, { error: 'too many signals' });
        const to = mm.get(String(body.to || ''));
        if (!to || to === me) return send(res, 404, { error: 'peer not in room' });
        const data = JSON.stringify(body.data || null);
        if (data.length > 8000) return send(res, 413, { error: 'signal too large' });
        if (to.queue.length < 200) to.queue.push({ from: player.id, data: body.data });
        return send(res, 200, { ok: true });
      }
      if (sub === 'report' && req.method === 'POST') {
        const body = await readBody(req);
        const target = mm.has(String(body.target || '')) ? String(body.target) : null;
        if (!target || target === player.id) return send(res, 404, { error: 'person not in room' });
        const reason = String(body.reason || 'unspecified').slice(0, 200);
        await store.addReport({ reporter: player.id, target, room: mine, reason, at: now });
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'unknown voice action' });
    }
    if (action === 'ludo') {
      const sub = parts[4] || '';
      const now = Date.now();
      sweepGames(now);
      let g = ludoGames.get(playerGame.get(player.id));
      if (g) Ludo.advance(g, now);
      if (g) await persistGame(g);
      if (req.method === 'GET' && !sub) { await ludoReward(g, player); return send(res, 200, { game: g ? Ludo.view(g, player.id) : null }); }
      if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
      if (sub === 'new') {
        const body = await readBody(req);
        if (g && g.status !== 'finished') return send(res, 409, { error: 'finish or leave your current game first', game: Ludo.view(g, player.id) });
        const me = { pid: player.id, name: player.name };
        if (body.mode === 'computer') {
          g = Ludo.newGame('g_' + crypto.randomBytes(5).toString('hex'), me, { pid: 'bot_' + crypto.randomBytes(3).toString('hex'), name: 'Computer', bot: true }, now);
        } else {
          g = null;
          for (const c of ludoGames.values()) if (c.status === 'waiting' && c.players[0].pid !== player.id) { g = c; break; }
          if (g) { g.players[1] = me; g.status = 'playing'; g.turnAt = now; g.rev++; Ludo.advance(g, now); }
          else g = Ludo.newGame('g_' + crypto.randomBytes(5).toString('hex'), me, null, now);
        }
        ludoGames.set(g.id, g);
        await persistGame(g);
        for (const p of g.players) if (p && !p.bot) playerGame.set(p.pid, g.id);
        return send(res, 201, { game: Ludo.view(g, player.id) });
      }
      if (!g) return send(res, 404, { error: 'no game' });
      if (sub === 'leave') {
        if (g.status === 'playing') {
          const i = g.players.findIndex(p => p && p.pid === player.id);
          g.status = 'finished'; g.winner = 1 - i; g.phase = 'done'; g.forfeit = true; g.rev++;
          g.log.push(player.name + ' left the game');
        } else if (g.status === 'waiting') ludoGames.delete(g.id);
        playerGame.delete(player.id);
        if (g.status === 'finished') await persistGame(g); else await store.deleteGame(g.id).catch(() => {});
        return send(res, 200, { game: null });
      }
      if (g.status !== 'playing') return send(res, 409, { error: 'game not in progress', game: Ludo.view(g, player.id) });
      if (g.players[g.turn].pid !== player.id) return send(res, 409, { error: 'not your turn', game: Ludo.view(g, player.id) });
      try {
        if (sub === 'roll') Ludo.roll(g, now);
        else if (sub === 'move') { const body = await readBody(req); const pc = Number(body.piece); if (!Number.isInteger(pc)) throw new Error('piece must be 0-3'); Ludo.move(g, pc, now); }
        else return send(res, 404, { error: 'unknown ludo action' });
      } catch (e) { return send(res, 409, { error: e.message, game: Ludo.view(g, player.id) }); }
      Ludo.advance(g, now);
      await persistGame(g);
      await ludoReward(g, player);
      return send(res, 200, { game: Ludo.view(g, player.id) });
    }
    if (action === 'echo') {
      const sub = parts[4] || '';
      const now = Date.now();
      sweepEcho(now);
      let g = echoGames.get(playerEcho.get(player.id));
      if (g) Echo.advance(g, now);
      if (req.method === 'GET' && !sub) return send(res, 200, { game: g ? Echo.view(g, player.id) : null });
      if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
      if (sub === 'new') {
        const body = await readBody(req);
        if (g && g.status !== 'finished') return send(res, 409, { error: 'finish or leave your current game first', game: Echo.view(g, player.id) });
        const me = { pid: player.id, name: player.name };
        if (body && body.mode === 'computer') {
          g = Echo.newGame('e_' + crypto.randomBytes(5).toString('hex'), me, { pid: 'bot_' + crypto.randomBytes(3).toString('hex'), name: 'Computer', bot: true }, now);
          Echo.start(g, now);
        } else {
          g = null;
          for (const c of echoGames.values()) if (c.status === 'waiting' && c.players[0].pid !== player.id) { g = c; break; }
          if (g) Echo.join(g, me, now);
          else g = Echo.newGame('e_' + crypto.randomBytes(5).toString('hex'), me, null, now);
        }
        echoGames.set(g.id, g);
        for (const p of g.players) if (p && !p.bot) playerEcho.set(p.pid, g.id);
        return send(res, 201, { game: Echo.view(g, player.id) });
      }
      if (!g) return send(res, 404, { error: 'no game' });
      if (sub === 'leave') {
        if (g.status === 'playing') {
          const i = g.players.findIndex(p => p && p.pid === player.id);
          g.status = 'finished'; g.winner = 1 - i; g.phase = 'done'; g.forfeit = true; g.rev++;
          g.log.push(player.name + ' left the game');
        } else if (g.status === 'waiting') echoGames.delete(g.id);
        playerEcho.delete(player.id);
        return send(res, 200, { game: null });
      }
      if (sub === 'submit') {
        const body = await readBody(req);
        try { Echo.submit(g, player.id, body && body.seq, now); } catch (e) { return send(res, 409, { error: e.message, game: Echo.view(g, player.id) }); }
        Echo.advance(g, now);
        return send(res, 200, { game: Echo.view(g, player.id) });
      }
      return send(res, 404, { error: 'unknown echo action' });
    }

    if (action === 'freeze') {
      const sub = parts[4] || '';
      const now = Date.now();
      sweepFreeze(now);
      let g = freezeGames.get(playerFreeze.get(player.id));
      if (g) Freeze.advance(g, now);
      if (req.method === 'GET' && !sub) return send(res, 200, { game: g ? Freeze.view(g, player.id) : null });
      if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
      if (sub === 'new') {
        const body = await readBody(req);
        if (g && g.status !== 'finished') return send(res, 409, { error: 'finish or leave your current game first', game: Freeze.view(g, player.id) });
        const me = { pid: player.id, name: player.name };
        if (body && body.mode === 'computer') {
          g = Freeze.newGame('f_' + crypto.randomBytes(5).toString('hex'), me, { pid: 'bot_' + crypto.randomBytes(3).toString('hex'), name: 'Computer', bot: true }, now);
          Freeze.start(g, now);
        } else {
          g = null;
          for (const c of freezeGames.values()) if (c.status === 'waiting' && c.players[0].pid !== player.id) { g = c; break; }
          if (g) Freeze.join(g, me, now);
          else g = Freeze.newGame('f_' + crypto.randomBytes(5).toString('hex'), me, null, now);
        }
        freezeGames.set(g.id, g);
        for (const p of g.players) if (p && !p.bot) playerFreeze.set(p.pid, g.id);
        return send(res, 201, { game: Freeze.view(g, player.id) });
      }
      if (!g) return send(res, 404, { error: 'no game' });
      if (sub === 'leave') {
        if (g.status === 'playing') {
          const i = g.players.findIndex(p => p && p.pid === player.id);
          g.status = 'finished'; g.winner = 1 - i; g.phase = 'done'; g.forfeit = true; g.rev++;
          g.log.push(player.name + ' left the game');
        } else if (g.status === 'waiting') freezeGames.delete(g.id);
        playerFreeze.delete(player.id);
        return send(res, 200, { game: null });
      }
      if (sub === 'tap') {
        const body = await readBody(req);
        try { Freeze.freeze(g, player.id, now, body && body.reactionMs); } catch (e) { return send(res, 409, { error: e.message, game: Freeze.view(g, player.id) }); }
        Freeze.advance(g, now);
        return send(res, 200, { game: Freeze.view(g, player.id) });
      }
      return send(res, 404, { error: 'unknown freeze action' });
    }
    if (req.method === 'POST' && action === 'ping') {
      if (!hit(pingPlayerRate, player.id, Date.now(), PING_RL_WIN, PING_RL_PLAYER)) return send(res, 429, { error: 'pinging too fast' });
      const body = await readBody(req);
      player.lastSeen = Date.now();
      if (body && CITIES.some(c => c[0] === body.city)) player.city = body.city;
      if (body && typeof body === 'object' && isFinite(+body.x) && isFinite(+body.z)) {
        const pcity = CITIES.some(c => c[0] === body.city) ? body.city : (player.city || 'kerala');
        if (trackPos(player.id, pcity, +body.x, +body.z, Date.now()) === 'too-fast') { rejects.ping++; return send(res, 200, { exploringTogether: await presenceCount() }); }
        // parked-vehicle claim: one holder per vehicle per city, in memory (single dyno); stale claims expire
        let pv = typeof body.pv === 'string' && /^[a-z]{2,12}:\d{1,2}$/.test(body.pv) ? body.pv : null, pvDenied = false;
        const tab = typeof body.tab === 'string' && /^[a-z0-9]{4,16}$/.test(body.tab) ? body.tab : 'x', nowMs = Date.now();
        for (const [k, c] of pvClaims) if (nowMs - c.t > PV_CLAIM_TTL_MS || (c.pid === player.id && k !== pv)) pvClaims.delete(k);
        if (pv) {
          const c = pvClaims.get(pv);
          if (c && !(c.pid === player.id && c.tab === tab)) { pv = null; pvDenied = true; } else pvClaims.set(pv, { pid: player.id, tab, t: nowMs });
        }
        // 118w beach-ball relay: last-toucher-owns with VALIDATED takeover - a client can only report a ball it owns, a stale ball, or a ball it stands next to whose owner went quiet; positions cannot teleport
        if (Array.isArray(body.bb)) {
          const bc = player.city || 'kerala'; let bm = cityBalls.get(bc); if (!bm) { bm = new Map(); cityBalls.set(bc, bm); }
          for (const row of body.bb.slice(0, 3)) {
            if (!Array.isArray(row) || row.length < 5) continue;
            const [bid, bx, bz, bvx, bvz] = row;
            if (typeof bid !== 'string' || !/^bb[0-2]$/.test(bid)) continue;
            if (![bx, bz, bvx, bvz].every(v => Number.isFinite(+v))) continue;
            const fx = +bx, fz = +bz, fvx = +bvx, fvz = +bvz;
            if (Math.abs(fx) > 132 || Math.abs(fz) > 132 || Math.hypot(fvx, fvz) > 15) continue;
            const cur = bm.get(bid);
            if (cur && nowMs - cur.t <= 6000 && (cur.pid !== player.id || cur.tab !== tab)) {
              const near = Math.hypot(+body.x - cur.x, +body.z - cur.z) <= 4; // takeover requires standing next to the ball...
              if (!near || nowMs - cur.t <= 1200) continue; // ...and the current owner quiet for a beat
            }
            if (cur && nowMs - cur.t <= 6000 && Math.hypot(fx - cur.x, fz - cur.z) > (nowMs - cur.t) / 1000 * 15 + 2.5) continue; // no teleports
            bm.set(bid, { x: fx, z: fz, vx: fvx, vz: fvz, pid: player.id, tab, t: nowMs });
          }
        }
        player.pos = { x: +body.x, z: +body.z, dir: +body.dir || 0, moving: !!body.moving, veh: ['car', 'scooter', 'roadster', 'supercar', 'suv', 'pickup', 'van', 'taxi', 'bike', 'bicycle', 'boat', 'flyster'].includes(body.veh) ? body.veh : null, pv, y: Math.max(0, Math.min(60, +body.y || 0)) };
      }
      // a player in voice who has arrived in a different city belongs to that city's room:
      // move them so they hear and are heard by the people around them now, not the city they left.
      const vCur = voiceOf.get(player.id), vWant = 'city:' + (player.city || 'kerala');
      if (vCur && vCur !== vWant) {
        const mOld = voiceRooms.get(vCur), meOld = mOld && mOld.get(player.id);
        const listenOnly = meOld ? !!meOld.listenOnly : false;
        voiceLeave(player.id);
        let mNew = voiceRooms.get(vWant); if (!mNew) { mNew = new Map(); voiceRooms.set(vWant, mNew); }
        if (mNew.size < VOICE_MAX) { mNew.set(player.id, { name: player.name, last: Date.now(), queue: [], listenOnly }); voiceOf.set(player.id, vWant); }
        else voiceDrops.set(player.id, Date.now()); // destination room full: client poll gets the precise 409 and offers rejoin
      }
      citySeenAt.set(player.id, { city: player.city || 'kerala', t: Date.now() });
      await store.putPlayer(player);
      return send(res, 200, { exploringTogether: await presenceCount(), pvDenied: !!(body && body.pv && player.pos && !player.pos.pv) });
    }
    if (action === 'events') {
      const now = Date.now(), eid = parts[4] || '', sub = parts[5] || '';
      if (req.method === 'GET' && !eid) {
        const city = CITIES.some(c => c[0] === url.searchParams.get('city')) ? url.searchParams.get('city') : (player.city || 'kerala');
        const pres = await eventPresence(now); Events.sweep(eventsDb, now, pres);
        const mine = [...eventsDb.values()].filter(e => e.host.id === player.id && !e.cancelled && e.endsAt > now).map(e => Events.view(e, now, player.id, pres));
        return send(res, 200, { city, stage: Events.STAGE_CITIES.includes(city), now: new Date(now).toISOString(), kinds: Events.KINDS, durable: store.showStore === true && !eventsDirty, events: Events.list(eventsDb, now, city, player.id, pres), mine });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
      const body = await readBody(req);
      const host = { id: player.id, name: player.name };
      let r; const pres = await eventPresence(now); Events.sweep(eventsDb, now, pres);
      if (!eid) r = Events.create(eventsDb, now, host, body || {});
      else if (sub === 'join') r = Events.join(eventsDb, now, host, eid, String((body || {}).role || ''));
      else if (sub === 'leave') r = Events.leave(eventsDb, now, host, eid);
      else if (sub === 'cancel') r = Events.cancel(eventsDb, now, host, eid);
      else return send(res, 404, { error: 'unknown event action' });
      if (r.error) return send(res, r.code || 400, { error: r.error, kinds: r.kinds });
      // write-through to the existing database so shows survive a restart; a failed write logs and
      // the in-memory show continues (the durable flag only promises persistence while PG is up)
      try {
        if (!eid) await eventWrite(async () => { await store.saveShow(r.event); await store.saveSignup(r.event.id, player.id, 'dancer', player.name); });
        else if (sub === 'join') await eventWrite(async () => { await store.saveSignup(eid, player.id, String((body || {}).role), player.name); });
        else if (sub === 'leave') await eventWrite(async () => { await store.removeSignup(eid, player.id); });
        else if (sub === 'cancel') await eventWrite(async () => { await store.saveShow(r.event); });
      } catch (err) { /* already logged by the chain's onError; the in-memory show continues */ }
      return send(res, 200, { event: Events.view(r.event, now, player.id, pres) });
    }
    if (req.method === 'POST' && action === 'emote') {
      const body = await readBody(req);
      if (String(body.emote || '') === 'none') { emotes.delete(player.id); return send(res, 200, { ok: true }); }
      if (!EMOTES.includes(String(body.emote || ''))) return send(res, 400, { error: 'unknown emote', emotes: EMOTES });
      emotes.set(player.id, { e: body.emote, t: Date.now() });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && action === 'pickups') {
      const now = Date.now();
      const city = CITIES.some(c => c[0] === url.searchParams.get('city')) ? url.searchParams.get('city') : (player.city || 'kerala');
      const sl = slotsFor(player.id, city, now);
      return send(res, 200, { city, radius: PICK_RADIUS, slots: sl.map(x => slotView(x, city)) });
    }
    if (req.method === 'POST' && action === 'collect') {
      const body = await readBody(req);
      let value, slotInfo = null;
      if (body && body.slot !== undefined) {
        const now = Date.now();
        if (!hit(collectRate, player.id + ':s', now, 1000, 6) || !hit(collectRate, player.id + ':m', now, 60000, 90)) return send(res, 429, { error: 'collecting too fast' });
        const cityId0 = CITIES.some(c => c[0] === body.city) ? body.city : (player.city || 'kerala');
        if (!spotsOf(cityId0).length) return send(res, 409, { error: 'pickups out of date' });
        const sl = slotsFor(player.id, cityId0, now)[+body.slot];
        if (!sl) return send(res, 409, { error: 'pickups out of date' });
        if (now < sl.ready) return send(res, 409, { error: 'not available yet' });
        const cx = +body.x, cz = +body.z;
        if (!isFinite(cx) || !isFinite(cz)) return send(res, 400, { error: 'position required' });
        const sp = spotsOf(cityId0)[sl.spot];
        if (Math.hypot(cx - sp[0], cz - sp[1]) > PICK_RADIUS) { rejects.near++; return send(res, 409, { error: 'too far from that pickup' }); }
        if (trackPos(player.id, cityId0, cx, cz, now) === 'too-fast') { rejects.fast++; return send(res, 409, { error: 'moving too fast' }); }
        value = ITEMS[sl.item];
        const delay = 16000 + Math.floor(Math.random() * 19000);
        const arr = slotsFor(player.id, cityId0, now), taken = new Set(arr.map(q => q.spot));
        const nxt = newSlot(sl.id, now, delay, cityId0, taken); arr[sl.id] = nxt;
        slotInfo = { next: slotView(nxt, cityId0), readyIn: delay };
      } else {
      if (LEGACY_MODE === 'off') return send(res, 410, { error: 'please reload the game' });
      legacyCollects++; legacyPlayers.set(player.id, Date.now()); if (legacyCollects % 20 === 1) console.log('legacy-collect count=' + legacyCollects);
      if (!ITEMS[String(body.item || '')]) return send(res, 400, { error: 'unknown item', items: Object.keys(ITEMS) });
      value = LEGACY_MODE === 'full' ? ITEMS[String(body.item)] : LEGACY_FLAT; // old clients cannot choose the value any more
      // full = byte-for-byte v20 behaviour for old tabs: never a 429, because a v20 tab swallows any collect error and silently
      // drifts from the stored score. The old exploit therefore stays open in this mode (disclosed, not fixed). The limiter below only
      // applies to the opt-in flat mode, which already changes legacy values and needs a communicated transition.
      if (LEGACY_MODE !== 'full') { const nw = Date.now(); if (!hit(collectRate, player.id + ':ls', nw, 5000, 8) || !hit(collectRate, player.id + ':lm', nw, 60000, 90)) return send(res, 429, { error: 'collecting too fast' }); }
      }
      const now2 = Date.now();
      const cityId = CITIES.some(c => c[0] === body.city) ? body.city : (player.city || 'kerala');
      player.lastSeen = now2; player.city = cityId;
      const newTotal = await store.addPoints(player.id, value);
      if (newTotal === null) return send(res, 404, { error: 'player not found' });
      player.points = newTotal;
      await store.putPlayer(player); // no longer touches points
      if (player.district !== 'none') await store.bumpDistrict(player.district, 0, value);
      await store.bumpCity(cityId, value);
      return send(res, 200, Object.assign({ player: publicPlayer(player), gained: value }, slotInfo || {}));
    }
    if (req.method === 'PATCH' && action === 'look') {
      const body = await readBody(req);
      player.look = cleanLook(body, player.look);
      player.lastSeen = Date.now();
      await store.putPlayer(player);
      return send(res, 200, { player: publicPlayer(player) });
    }
    return send(res, 404, { error: 'unknown player action' });
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboards') {
    const players = (await store.allPlayers()).map(publicPlayer);
    const rows = await store.districtRows();
    const districts = DISTRICTS.map(([id, en, ml]) => {
      const row = rows.find(r => r.id === id) || { points: 0, players: 0 };
      return { id, name: en, malayalam: ml, points: Number(row.points), playing: Number(row.players) };
    }).sort((a, b) => b.points - a.points);
    const cityRows = await store.cityRows();
    const counts = await store.activeCityCounts(Date.now() - PRESENCE_TTL_MS);
    const cities = CITIES.map(([id, name, local, country, parent, note]) => ({
      id, name, local, country, parent: parent || null, note: note || null,
      points: Number((cityRows.find(r => r.id === id) || { points: 0 }).points),
      online: counts[id] || 0,
    })).sort((a, b) => b.points - a.points);
    return send(res, 200, { players, districts, cities, exploringTogether: await presenceCount() });
  }
  if (req.method === 'GET' && url.pathname === '/api/cities') {
    const cityRows = await store.cityRows();
    const nowC = Date.now();
    const counts = await store.activeCityCounts(nowC - PRESENCE_TTL_MS);
    return send(res, 200, { goal: CITY_GOAL, cities: CITIES.map(([id, name, local, country, parent, note]) => ({
      id, name, local, country, parent: parent || null, note: note || null,
      points: Number((cityRows.find(r => r.id === id) || { points: 0 }).points),
      online: counts[id] || 0,
      live: [...eventsDb.values()].filter(e => e.city === id && !e.cancelled && e.startsAt <= nowC && e.endsAt > nowC).map(e => e.kind), // kinds only - no host identity
    })) });
  }

  if (req.method === 'GET' && url.pathname === '/api/world') {
    const now = Date.now();
    const city = CITIES.some(c => c[0] === url.searchParams.get('city')) ? url.searchParams.get('city') : 'kerala';
    const counts = await store.activeCityCounts(now - PRESENCE_TTL_MS);
    // Use the caller's already-stored same-city position. No coordinates in URLs
    // or added location storage, and callers cannot choose another player's origin.
    let origin = null;
    const nearId = url.searchParams.get('near');
    if (nearId) { const me = await store.getPlayer(nearId);
      if (me && checkToken(me.token, req.headers.authorization) && (me.city || 'kerala') === city && me.pos && Number.isFinite(me.pos.x) && Number.isFinite(me.pos.z)) origin = { x: me.pos.x, z: me.pos.z };
    }
    const here = (await store.activePlayersInCity(now - PRESENCE_TTL_MS, city, 60, origin)).filter(p => p.pos && isFinite(+p.pos.x));
    const players = here.map(p => {
      const em = emotes.get(p.id);
      return { id: p.id, name: p.name, district: p.district, city, look: p.look, pos: (p.pos && p.pos.pv && (pvClaims.get(p.pos.pv) || {}).pid !== p.id) ? Object.assign({}, p.pos, { pv: null }) : p.pos, emote: em && now - em.t < (EMOTE_MS[em.e] || 4000) ? em.e : null };
    });
    for (const [id, em] of emotes) if (now - em.t > (EMOTE_MS[em.e] || 4000) + 2000) emotes.delete(id);
    const cityRows = await store.cityRows();
    const pts = Number((cityRows.find(r => r.id === city) || { points: 0 }).points);
    const bmW = cityBalls.get(city), bb = []; // 118w: serve fresh ball states; sweep stale
    if (bmW) { for (const [bid, v] of bmW) { if (now - v.t < 10000) bb.push([bid, v.x, v.z, v.vx, v.vz, v.pid]); else bmW.delete(bid); } }
    return send(res, 200, { now, players, city, online: counts[city] || 0, bb,
      goal: { points: pts % CITY_GOAL, target: CITY_GOAL, rounds: Math.floor(pts / CITY_GOAL) },
      exploringTogether: Object.values(counts).reduce((a, b) => a + b, 0) });
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    const city = url.searchParams.get('city') || 'kerala';
    if (!CITIES.some(c => c[0] === city)) return send(res, 400, { error: 'unknown city' });
    const now = Date.now();
    return send(res, 200, { city, stage: Events.STAGE_CITIES.includes(city), now: new Date(now).toISOString(), kinds: Events.KINDS, durable: store.showStore === true && !eventsDirty, events: Events.list(eventsDb, now, city, null, await eventPresence(now)) });
  }
  if (req.method === 'GET' && url.pathname === '/api/presence') {
    return send(res, 200, { exploringTogether: await presenceCount() });
  }
  if (req.method === 'POST' && url.pathname === '/api/voice-diag') {
    const b = await readBody(req).catch(() => ({}));
    const ok = v => String(v || '').replace(/[^a-z-]/g, '').slice(0, 14);
    voiceDiagN = (voiceDiagN || 0) + 1;
    if (voiceDiagN <= 5000) console.log('voice-diag', ok(b.s), 'ice=' + ok(b.ice), 'role=' + ok(b.role), 'ms=' + Math.min(99999, Number(b.ms) || 0));
    return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    { const cut = Date.now() - 86400000; for (const [k, t] of legacyPlayers) if (t < cut) legacyPlayers.delete(k); }
    return send(res, 200, { ok: true, storage: store.kind, voice: VOICE_ENABLED, voiceMax: VOICE_MAX, legacyMode: LEGACY_MODE, legacyCollects, legacyPlayers24h: legacyPlayers.size });
  }
  return send(res, 404, { error: 'not found' });
}

function sweepFreezeGames(now) {
  for (const [id, g] of freezeGames) {
    if (g.status === 'waiting' && now - g.created > Freeze.CFG.WAIT_MS) { freezeGames.delete(id); playerFreeze.delete(g.players[0].pid); }
    else if (g.status === 'finished' && now - g.phaseAt > Freeze.CFG.DONE_KEEP_MS) { freezeGames.delete(id); for (const p of g.players) if (p && !p.bot) playerFreeze.delete(p.pid); }
  }
}
function sweepFreeze(now) { sweepFreezeGames(now); for (const g of freezeGames.values()) Freeze.advance(g, now); }
function sweepEcho(now) {
  for (const [id, g] of echoGames) {
    if (g.status === 'waiting' && now - g.created > Echo.WAIT_MS) { echoGames.delete(id); playerEcho.delete(g.players[0].pid); }
    else if (g.status === 'finished' && now - g.phaseAt > Echo.DONE_KEEP_MS) { echoGames.delete(id); for (const p of g.players) if (p && !p.bot) playerEcho.delete(p.pid); }
  }
}
const citySeenAt = new Map(); // playerId -> { city, t } of last ping (stage-show host grace is per show city)
async function eventPresence(now) {
  const ids = new Set();
  for (const e of eventsDb.values()) if (!e.cancelled && e.endsAt > now) { ids.add(e.host.id); for (const id of e.dancers.keys()) ids.add(id); for (const id of e.audience) ids.add(id); }
  let rows = [];
  try { rows = await store.activePlayersByIds([...ids]); } // narrow: only show members, never the whole active world
  catch (err) { console.error('event presence lookup failed (counts degrade, shows keep running):', err.message); }
  for (const [id, s] of citySeenAt) if (s.t < now - Events.HOST_GRACE_MS * 2) citySeenAt.delete(id);
  return Events.buildPresence(rows, citySeenAt, now, PRESENCE_TTL_MS);
}
async function presenceCount() {
  const counts = await store.activeCityCounts(Date.now() - PRESENCE_TTL_MS);
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

async function main() {
  Events.setBootAt(Date.now());
  store = process.env.DATABASE_URL ? await initPostgres(process.env.DATABASE_URL) : initJson(DATA_FILE);
  Events.setChangeSink(ch => {
    eventWrite(async () => {
      for (const e of ch.cancelled) await store.saveShow(e);
      if (ch.deleted.length) await store.deleteShows(ch.deleted);
    }).catch(() => { if (ch.deleted.length) { pendingEventDeletes.push(ch.deleted); if (pendingEventDeletes.length > 64) pendingEventDeletes.splice(0, pendingEventDeletes.length - 64); } });
  });
  // retention + recovery cadence while the server keeps running: every sweep retries a dirty state
  // (reconcile re-syncs everything from memory) and applies the 10-minute deletion rule. Deletions
  // normally land at the 10-minute mark via the request-driven sweep sink; this bounds recovery of
  // a failed delete to one sweep interval and covers idle servers with no API traffic.
  const purgeEvery = +process.env.EVENT_PURGE_SWEEP_MS > 0 ? +process.env.EVENT_PURGE_SWEEP_MS : 60000;
  setInterval(() => {
    eventWrite(async () => {
      if (eventsDirty || pendingEventDeletes.length) await reconcileEvents();
      const n = await store.purgeShows(Date.now() - Events.LIMITS.keepEndedMs);
      if (n) console.log('events: purged', n, 'show(s) past the 10-minute keep window');
    }).catch(() => {});
  }, purgeEvery).unref();
  await loadLudo();
  await loadEvents();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] === 'api') return await handleApi(req, res, url, parts);
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
      return send(res, 405, { error: 'method not allowed' });
    } catch (err) {
      return send(res, 400, { error: err.message || 'bad request' });
    }
  });
  server.listen(PORT, () => {
    console.log(`Little Kerala (independent recreation) on http://localhost:${PORT} - storage: ${store.kind}`);
  });
}

main().catch(err => { console.error('startup failed:', err); process.exit(1); });
