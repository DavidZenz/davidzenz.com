import { writeFile, readFile, mkdir } from "node:fs/promises";

// Pulls every run from Runalyze and buckets distance by calendar month, so the
// site (and the Porto deck) can draw a real cumulative-km line. Needs
// RUNALYZE_TOKEN; without it the cached file is kept untouched.

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("runningHistory.json", OUT_DIR);

const token = process.env.RUNALYZE_TOKEN;
const headers = { token, Accept: "application/json" };

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Runalyze API ${url} failed: ${res.status} ${res.statusText}`);
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

function round1(n) {
  return Math.round(n * 10) / 10;
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

  if (!token) {
    console.warn("[fetch-running-history] RUNALYZE_TOKEN not set, keeping cached file");
    return;
  }

  let monthly;
  try {
    const activities = await fetchAllActivities();
    const runs = activities.filter((a) => a.sport?.name === "Laufen");

    const byMonth = new Map();
    for (const run of runs) {
      const distance = Number(run.distance);
      if (!Number.isFinite(distance)) continue;
      const month = String(run.date_time).slice(0, 7); // YYYY-MM
      byMonth.set(month, (byMonth.get(month) ?? 0) + distance);
    }

    const months = [...byMonth.keys()].sort();
    let cumulative = 0;
    monthly = months.map((month) => {
      const km = round1(byMonth.get(month));
      cumulative = round1(cumulative + km);
      return { month, km, cumulativeKm: cumulative };
    });
  } catch (err) {
    console.warn(`[fetch-running-history] keeping cached file: ${err.message}`);
    const cached = await loadCache();
    if (!cached) return;
    monthly = cached.monthly;
  }

  const data = { fetchedAt: new Date().toISOString(), monthly };
  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `[fetch-running-history] wrote ${monthly.length} months (` +
      `${monthly[0]?.month}–${monthly.at(-1)?.month}, ` +
      `${monthly.at(-1)?.cumulativeKm} km total) to ${OUT_FILE.pathname}`
  );
}

main();
