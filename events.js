/**
 * Little World stage shows: real, player-hosted, non-monetary lifecycle.
 * Anyone can host a show on any city's stage and anyone can join as a dancer
 * or as audience. No schedule is invented: if nobody hosts, the list is empty.
 * State lives in memory and, when the server has Postgres (production), is written through to the
 * existing database: shows and signups survive a restart, are deleted 10 minutes after a show ends
 * or is cancelled, and a host has 3 minutes to reconnect after a restart before the show cancels.
 * The API reports durable: true only when that write-through is active (json-file dev store: false).
 * Titles are chosen from a fixed list (no free text shown to other players).
 * No tips, prizes or points. Times are absolute UTC instants; clients format
 * them in the viewer's zone, so there is no offset table to get wrong.
 */
'use strict';

const fs = require('fs'), path = require('path');
// Per-city stage platform rects, extracted from the client city generator by
// scripts/extract-stages.mjs (generation is seeded per city, so these are stable).
const STAGES = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'stages.json'), 'utf8')).stages; }
  catch { return { kerala: { x: 14, z: 0, w: 16, d: 10 } }; }
})();
const STAGE_CITIES = Object.keys(STAGES);
const KINDS = { 'open-stage': 'Open Stage', 'dance-night': 'Dance Night', 'music-hour': 'Music Hour', 'folk-show': 'Folk Show', 'party-time': 'Party Time' };
const LIMITS = { maxAheadMin: 48 * 60, durationMin: 30, maxDancers: 6, maxAudience: 100, perHost: 2, perCity: 12, keepEndedMs: 10 * 60000 };

function status(e, now) { return e.cancelled ? 'cancelled' : now >= e.endsAt ? 'ended' : now >= e.startsAt ? 'live' : 'upcoming'; }

function create(db, now, host, input) {
  const kind = String(input && input.kind || '');
  const city = String((input && input.city) || 'kerala');
  if (!STAGE_CITIES.includes(city)) return { error: 'no stage in this city yet', code: 400 };
  if (!KINDS[kind]) return { error: 'unknown show type', code: 400, kinds: Object.keys(KINDS) };
  let startsAt;
  if (input.startsAt === undefined || input.startsAt === null || input.startsAt === 'now') startsAt = now;
  else {
    if (typeof input.startsAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(input.startsAt)) return { error: 'startsAt must be an ISO time with a zone, e.g. 2026-10-25T13:30:00Z', code: 400 };
    startsAt = Date.parse(input.startsAt);
    if (!isFinite(startsAt)) return { error: 'invalid startsAt', code: 400 };
    if (startsAt < now - 60000) return { error: 'startsAt is in the past', code: 400 };
    if (startsAt > now + LIMITS.maxAheadMin * 60000) return { error: 'too far ahead (max 48 hours)', code: 400 };
    if (startsAt < now) startsAt = now;
  }
  sweep(db, now);
  const mine = [...db.values()].filter(e => e.host.id === host.id && !e.cancelled && e.endsAt > now).length;
  if (mine >= LIMITS.perHost) return { error: 'you already host ' + LIMITS.perHost + ' shows', code: 409 };
  if ([...db.values()].filter(e => e.city === city && !e.cancelled && e.endsAt > now).length >= LIMITS.perCity) return { error: 'the stage calendar is full', code: 409 };
  // one show at a time on the stage: no overlap
  const endsAt = startsAt + LIMITS.durationMin * 60000;
  for (const o of db.values()) if (o.city === city && !o.cancelled && o.endsAt > now && startsAt < o.endsAt && o.startsAt < endsAt) return { error: 'the stage is already booked then', code: 409, clash: o.id };
  const id = 'ev_' + now.toString(36) + Math.random().toString(36).slice(2, 7);
  const e = { id, city, kind, title: KINDS[kind], startsAt, endsAt, host: { id: host.id, name: host.name }, dancers: new Map(), audience: new Set(), cancelled: false, createdAt: now };
  e.dancers.set(host.id, host.name);
  db.set(id, e);
  return { event: e };
}

function join(db, now, player, id, role) {
  const e = db.get(id); if (!e) return { error: 'no such show', code: 404 };
  const st = status(e, now); if (st === 'ended' || st === 'cancelled') return { error: 'this show is ' + st, code: 409 };
  if (role !== 'dancer' && role !== 'audience') return { error: 'role must be dancer or audience', code: 400 };
  if (role === 'dancer') {
    if (!e.dancers.has(player.id) && e.dancers.size >= LIMITS.maxDancers) return { error: 'the dancer slots are full - join as audience', code: 409 };
    e.audience.delete(player.id); e.dancers.set(player.id, player.name);
  } else {
    if (e.host.id === player.id) return { error: 'the host stays on stage', code: 409 };
    if (!e.audience.has(player.id) && e.audience.size >= LIMITS.maxAudience) return { error: 'audience is full', code: 409 };
    e.dancers.delete(player.id); e.audience.add(player.id);
  }
  return { event: e };
}

function leave(db, now, player, id) {
  const e = db.get(id); if (!e) return { error: 'no such show', code: 404 };
  if (e.host.id === player.id) return { error: 'the host can cancel instead', code: 409 };
  e.dancers.delete(player.id); e.audience.delete(player.id);
  return { event: e };
}

function cancel(db, now, player, id) {
  const e = db.get(id); if (!e) return { error: 'no such show', code: 404 };
  if (e.host.id !== player.id) return { error: 'only the host can cancel', code: 403 };
  if (status(e, now) === 'ended') return { error: 'already ended', code: 409 };
  e.cancelled = true; e.cancelledAt = now; return { event: e };
}

const HOST_GRACE_MS = 3 * 60000;
// presence = { grace: Set(player ids seen within HOST_GRACE_MS), active: Set(ids seen within ~1 min), onStage: Set(ids physically on the stage platform now) }
// bootAt: server start time. After a restart the host-away clock is measured from the later of the
// show's start and the boot, so a restored host gets a full HOST_GRACE_MS to ping again before the
// show is cancelled. Set once at boot via setBootAt so every sweep path (including list's internal
// one) honors the grace; an explicit argument wins (tests). Returns the changes and reports them to
// the sink set via setChangeSink so the caller can persist them (cancelled shows, deleted ids).
let BOOT_AT = 0, CHANGE_SINK = null;
function setBootAt(t) { BOOT_AT = +t || 0; }
function setChangeSink(fn) { CHANGE_SINK = typeof fn === 'function' ? fn : null; }
function sweep(db, now, presence, bootAt) {
  if (bootAt === undefined) bootAt = BOOT_AT;
  const changed = { cancelled: [], deleted: [] };
  if (presence) for (const e of db.values()) if (!e.cancelled && now >= Math.max(e.startsAt, bootAt || 0) + HOST_GRACE_MS && now < e.endsAt && !presence.inGrace(e.host.id, e.city)) { e.cancelled = true; e.cancelledAt = now; e.cancelReason = 'host left'; changed.cancelled.push(e); }
  for (const [id, e] of db) if ((e.cancelled || e.endsAt <= now) && now - Math.min(e.endsAt, e.cancelledAt || e.endsAt) > LIMITS.keepEndedMs) { db.delete(id); changed.deleted.push(id); }
  if (CHANGE_SINK && (changed.cancelled.length || changed.deleted.length)) CHANGE_SINK(changed);
  return changed; }

/* ---- persistence write ordering: one serialized chain per server so a slow cancel save can never
 * land after a later delete and resurrect a row. A failed write rejects for its caller, is reported
 * via onError, and does not break later writes. ---- */
function serialWriter(onError) {
  let chain = Promise.resolve();
  return fn => { const p = chain.then(fn); chain = p.then(() => null, err => { if (onError) onError(err); }); return p; };
}

/* ---- reconcile: make the database match memory after a failed write. The in-memory db is the
 * source of truth for live state. Retries queued deletions first (no resurrection), then upserts
 * every show with its exact membership and removes signup rows that are no longer in memory
 * (ghost signups from a failed leave/removal). Audience rows are upserted nameless: audience
 * names are never displayed (only counts), and a row created by the original join keeps its name
 * because syncSignups only deletes what memory no longer holds. ---- */
async function reconcileShows(db, store, pendingDeletes) {
  const dels = pendingDeletes ? pendingDeletes.splice(0) : [];
  for (const ids of dels) await store.deleteShows(ids);
  for (const e of db.values()) {
    await store.saveShow(e);
    const memberIds = [...e.dancers.keys(), ...e.audience];
    if (!memberIds.includes(e.host.id)) memberIds.push(e.host.id);
    if (store.syncSignups) await store.syncSignups(e.id, memberIds);
    for (const [pid, name] of e.dancers) await store.saveSignup(e.id, pid, 'dancer', name);
    for (const pid of e.audience) await store.saveSignup(e.id, pid, 'audience', '');
  }
}

/* ---- persistence row conversion (existing Postgres tables event_shows/event_signups) ---- */
function showRow(e) {
  return { id: e.id, city: e.city, kind: e.kind, title: e.title, starts_at: e.startsAt, ends_at: e.endsAt,
    host_id: e.host.id, host_name: e.host.name, cancelled: !!e.cancelled,
    cancelled_at: e.cancelledAt == null ? null : e.cancelledAt, cancel_reason: e.cancelReason || null, created_at: e.createdAt || e.startsAt };
}
function fromRow(row, signups) {
  const e = { id: row.id, city: row.city, kind: row.kind, title: row.title, startsAt: +row.starts_at, endsAt: +row.ends_at,
    host: { id: row.host_id, name: row.host_name }, dancers: new Map(), audience: new Set(),
    cancelled: !!row.cancelled, createdAt: +row.created_at || +row.starts_at };
  if (row.cancelled_at != null) e.cancelledAt = +row.cancelled_at;
  if (row.cancel_reason) e.cancelReason = row.cancel_reason;
  e.dancers.set(e.host.id, e.host.name); // the host is always on stage, even if a signup row is missing
  for (const s of signups || []) if (s.player_id !== e.host.id) { if (s.role === 'dancer') e.dancers.set(s.player_id, s.name); else e.audience.add(s.player_id); }
  return e;
}

// City-aware presence from player rows. seen: id -> { city, t } of the player's last ping (a player is in
// exactly one city at a time). inGrace(id, city) = last pinged in that city within HOST_GRACE_MS (a host who
// travels away ends the show only after that long away); isActive(id, city) = pinged within ttl AND currently
// in that city; isOnStage(id, city) = active and physically on that city's stage platform.
function buildPresence(rows, seen, now, ttl) {
  const byId = new Map(); for (const r of rows) byId.set(r.id, r);
  return {
    inGrace(id, city) { const s = seen.get(id); return !!(s && s.city === city && s.t >= now - HOST_GRACE_MS); },
    isActive(id, city) { const r = byId.get(id); return !!(r && (r.city || 'kerala') === city && Number(r.lastSeen || r.last_seen || 0) >= now - ttl); },
    isOnStage(id, city) {
      const r = byId.get(id), st = STAGES[city]; if (!r || !st || !this.isActive(id, city)) return false;
      const pos = r.pos; return !!(pos && Math.abs(+pos.x - st.x) < st.w / 2 && Math.abs(+pos.z - st.z) < st.d / 2);
    },
  };
}

function view(e, now, meId, presence) {
  const act = id => !presence || presence.isActive(id, e.city);
  const dancers = [...e.dancers].filter(([id]) => act(id) || id === e.host.id).map(([, n]) => n);
  return {
    id: e.id, city: e.city, kind: e.kind, title: e.title, status: status(e, now),
    startsAt: new Date(e.startsAt).toISOString(), endsAt: new Date(e.endsAt).toISOString(),
    host: { name: e.host.name }, dancers, signedUpDancers: dancers.length, dancerSlots: LIMITS.maxDancers, signedUpAudience: [...e.audience].filter(act).length, audienceCount: [...e.audience].filter(act).length,
    onStageNow: presence ? [...e.dancers.keys()].filter(id => presence.isOnStage(id, e.city)).length : null, cancelReason: e.cancelReason || undefined,
    you: meId ? (e.host.id === meId ? 'host' : e.dancers.has(meId) ? 'dancer' : e.audience.has(meId) ? 'audience' : null) : undefined,
  };
}

function list(db, now, city, meId, presence) {
  sweep(db, now, presence);
  return [...db.values()].filter(e => e.city === city && !e.cancelled && e.endsAt > now).sort((a, b) => a.startsAt - b.startsAt).map(e => view(e, now, meId, presence));
}

const STAGE = STAGES.kerala; // kept for existing callers; prefer STAGES[city]
module.exports = { buildPresence, STAGE, STAGES, HOST_GRACE_MS, create, join, leave, cancel, list, view, status, sweep, setBootAt, setChangeSink, serialWriter, reconcileShows, showRow, fromRow, KINDS, LIMITS, STAGE_CITIES };
