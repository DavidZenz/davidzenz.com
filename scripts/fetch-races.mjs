import { writeFile, readFile, mkdir } from "node:fs/promises";

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("races.json", OUT_DIR);

const token = process.env.RUNALYZE_TOKEN;
const headers = { token, Accept: "application/json" };

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
        let point = cached ? { lat: cached.lat, lon: cached.lon } : null;
        if (!point) {
          point = await fetchStartPoint(r.activity_id);
          fetched++;
        }
        if (!point) continue;

        races.push({
          activity_id: r.activity_id,
          date: r.date,
          name: r.name,
          distance: r.official_distance,
          lat: point.lat,
          lon: point.lon,
        });
      }
    } catch (err) {
      console.warn(`[fetch-races] keeping cached data set: ${err.message}`);
      races = [...cache.values()];
    }
  }

  const data = { fetchedAt: new Date().toISOString(), races };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `[fetch-races] wrote ${data.races.length} races (${fetched} newly fetched) to ${OUT_FILE.pathname}`
  );
}

main();
