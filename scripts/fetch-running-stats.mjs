import { writeFile, readFile, mkdir } from "node:fs/promises";

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("runningStats.json", OUT_DIR);
const RACES_FILE = new URL("races.json", OUT_DIR);

const token = process.env.RUNALYZE_TOKEN;
const headers = { token, Accept: "application/json" };

const MARATHON_MIN_KM = 40;
const MARATHON_MAX_KM = 44;
const MAJOR_KEYWORDS = ["berlin", "boston", "chicago", "london", "new york", "nyc", "tokyo"];

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Runalyze API ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllActivities() {
  const activities = [];
  const pageSize = 300;
  for (let page = 1; ; page++) {
    const batch = await fetchJson(
      `https://runalyze.com/api/v1/activity?page=${page}&itemsPerPage=${pageSize}`
    );
    activities.push(...batch);
    if (batch.length < pageSize) break;
  }
  return activities;
}

function localDate(dateTime) {
  return dateTime.slice(0, 10);
}

function todayInVienna() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function computeDistanceStats(runs) {
  const today = todayInVienna();
  const monday = mondayOf(today);
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);

  let thisWeek = 0;
  let month = 0;
  let year = 0;
  let total = 0;

  for (const run of runs) {
    const date = localDate(run.date_time);
    total += run.distance;
    if (date >= monday) thisWeek += run.distance;
    if (date.startsWith(thisMonth)) month += run.distance;
    if (date.startsWith(thisYear)) year += run.distance;
  }

  return {
    thisWeek: round1(thisWeek),
    thisMonth: round1(month),
    thisYear: round1(year),
    total: round1(total),
  };
}

async function raceStats() {
  try {
    const raw = await readFile(RACES_FILE, "utf-8");
    const races = JSON.parse(raw).races ?? [];
    const marathons = races.filter(
      (r) => r.distance_km >= MARATHON_MIN_KM && r.distance_km <= MARATHON_MAX_KM
    );
    const majors = marathons.filter((r) =>
      MAJOR_KEYWORDS.some((kw) => r.name.toLowerCase().includes(kw))
    );
    return { raceCount: races.length, marathonCount: marathons.length, majorCount: majors.length };
  } catch {
    return { raceCount: 0, marathonCount: 0, majorCount: 0 };
  }
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(OUT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let distanceKm = null;

  if (!token) {
    console.warn("[fetch-running-stats] RUNALYZE_TOKEN not set, keeping cached data set");
  } else {
    try {
      const activities = await fetchAllActivities();
      const runs = activities.filter((a) => a.sport?.name === "Laufen");
      distanceKm = computeDistanceStats(runs);
    } catch (err) {
      console.warn(`[fetch-running-stats] keeping cached data set: ${err.message}`);
    }
  }

  if (!distanceKm) {
    const cached = await loadCache();
    distanceKm = cached?.distanceKm ?? { thisWeek: 0, thisMonth: 0, thisYear: 0, total: 0 };
  }

  const data = { fetchedAt: new Date().toISOString(), distanceKm, ...(await raceStats()) };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(`[fetch-running-stats] wrote stats to ${OUT_FILE.pathname}`);
}

main();
