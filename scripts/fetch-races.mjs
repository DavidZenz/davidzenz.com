import { writeFile, readFile, mkdir } from "node:fs/promises";

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("races.json", OUT_DIR);

const token = process.env.RUNALYZE_TOKEN;
const headers = { token, Accept: "application/json" };

const PB_CATEGORIES = [
  { distance: "5k", min: 4.5, max: 5.5 },
  { distance: "10k", min: 9, max: 11 },
  { distance: "Half Marathon", min: 20, max: 22.5 },
  { distance: "Marathon", min: 40, max: 44 },
];

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

function computePbs(races) {
  const pbs = [];
  for (const cat of PB_CATEGORIES) {
    const candidates = races.filter(
      (r) => r.distance_km >= cat.min && r.distance_km <= cat.max && r.duration_s
    );
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (a.duration_s < b.duration_s ? a : b));
    pbs.push({ distance: cat.distance, time: formatTime(best.duration_s), note: "race" });
  }
  return pbs;
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

        races.push({
          activity_id: r.activity_id,
          date: r.date,
          name: r.name,
          distance_km: activity.distance,
          duration_s: activity.duration,
          lat: point.lat,
          lon: point.lon,
        });
      }
    } catch (err) {
      console.warn(`[fetch-races] keeping cached data set: ${err.message}`);
      races = [...cache.values()];
    }
  }

  const data = { fetchedAt: new Date().toISOString(), races, pbs: computePbs(races) };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `[fetch-races] wrote ${data.races.length} races (${fetched} newly fetched), ${data.pbs.length} PBs to ${OUT_FILE.pathname}`
  );
}

main();
