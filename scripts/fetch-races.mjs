import { writeFile, readFile, mkdir } from "node:fs/promises";

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("races.json", OUT_DIR);

const token = process.env.RUNALYZE_TOKEN;
const headers = { token, Accept: "application/json" };

const PB_CATEGORIES = [
  { distance: "5k", min: 4.5, max: 5.5, officialKm: 5 },
  { distance: "10k", min: 9, max: 11, officialKm: 10 },
  { distance: "Half Marathon", min: 20, max: 22.5, officialKm: 21.0975 },
  { distance: "Marathon", min: 40, max: 44, officialKm: 42.195 },
];

function categoryFromName(name) {
  const n = name.toLowerCase();
  if (/halbmarathon|half[\s-]*marathon|\bhm\b/.test(n)) return "Half Marathon";
  if (/\bmarathon\b/.test(n) && !/halb|half/.test(n)) return "Marathon";
  if (/\b10\s*k(m)?\b/.test(n)) return "10k";
  if (/\b5\s*k(m)?\b/.test(n)) return "5k";
  return null;
}

// GPS-recorded distance can be way off official distance (watch kept
// running past the finish, warm-up/cool-down included, etc). If the
// distance doesn't land in a category's range, fall back to the race
// name — Runalyze race names reliably say "Marathon"/"Halbmarathon"/etc.
function officialDistanceFor(km, name = "") {
  const byDistance = PB_CATEGORIES.find((c) => km >= c.min && km <= c.max);
  if (byDistance) return byDistance.officialKm;
  const byName = PB_CATEGORIES.find((c) => c.distance === categoryFromName(name));
  return byName ? byName.officialKm : null;
}

async function loadCache() {
  try {
    const raw = await readFile(OUT_FILE, "utf-8");
    const data = JSON.parse(raw);
    const byActivityId = new Map();
    for (const race of data.races ?? []) {
      if (race.activity_id) byActivityId.set(race.activity_id, race);
    }
    return byActivityId;
  } catch {
    return new Map();
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Runalyze API ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchStartPoint(activityId) {
  const res = await fetch(`https://runalyze.com/api/v1/activity/${activityId}/gpx`, { headers });
  if (!res.ok) return null;
  const gpx = await res.text();
  const match = gpx.match(/<trkpt lat="(-?[\d.]+)" lon="(-?[\d.]+)"/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

async function fetchActivity(activityId) {
  try {
    return await fetchJson(`https://runalyze.com/api/v1/activity/${activityId}`);
  } catch {
    return null;
  }
}

function formatTime(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function bestTime(race) {
  return race.official_time_s ?? race.duration_s;
}

function computePbs(races) {
  const pbs = [];
  for (const cat of PB_CATEGORIES) {
    const candidates = races.filter(
      (r) => r.official_distance_km === cat.officialKm && bestTime(r)
    );
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (bestTime(a) < bestTime(b) ? a : b));
    pbs.push({ distance: cat.distance, time: formatTime(bestTime(best)), note: "race" });
  }
  return pbs;
}

function dedupeRaces(races) {
  const seen = new Set();
  const deduped = [];
  for (const race of races) {
    const key = `${race.date}|${race.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(race);
  }
  return deduped;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const cache = await loadCache();
  let races = [...cache.values()];
  let fetched = 0;

  if (!token) {
    console.warn("[fetch-races] RUNALYZE_TOKEN not set, keeping cached data set");
  } else {
    try {
      const results = await fetchJson("https://runalyze.com/api/v1/raceresult");
      races = [];
      for (const r of results) {
        if (!r.activity_id || !r.name) continue;

        const cached = cache.get(r.activity_id);
        if (cached) {
          races.push(cached);
          continue;
        }

        const [point, activity] = await Promise.all([
          fetchStartPoint(r.activity_id),
          fetchActivity(r.activity_id),
        ]);
        fetched++;
        if (!point || !activity) continue;

        // Runalyze's raceresult API has a schema bug: the documented
        // "official_distance" (km) property collides with a separate
        // "official time in seconds" property, and only the latter actually
        // comes through in the JSON response. So r.official_distance here is
        // really the official finish time, when the user has recorded one.
        races.push({
          activity_id: r.activity_id,
          date: r.date,
          name: r.name,
          distance_km: activity.distance,
          official_distance_km: officialDistanceFor(activity.distance),
          duration_s: activity.duration,
          official_time_s: r.official_distance ?? null,
          lat: point.lat,
          lon: point.lon,
        });
      }
    } catch (err) {
      console.warn(`[fetch-races] keeping cached data set: ${err.message}`);
      races = [...cache.values()];
    }
  }

  races = races.map((r) => ({ ...r, official_distance_km: officialDistanceFor(r.distance_km, r.name) }));
  races = dedupeRaces(races);

  const data = { fetchedAt: new Date().toISOString(), races, pbs: computePbs(races) };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `[fetch-races] wrote ${data.races.length} races (${fetched} newly fetched), ${data.pbs.length} PBs to ${OUT_FILE.pathname}`
  );
}

main();
