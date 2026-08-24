import { writeFile, mkdir } from "node:fs/promises";

const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("gigs.json", OUT_DIR);

const ARTISTS = [
  { name: "Brewtality", envKey: "BANDSINTOWN_KEY_BREWTALITY" },
  { name: "Metternich", envKey: "BANDSINTOWN_KEY_METTERNICH" },
];

async function fetchUpcoming({ name, envKey }) {
  const appId = process.env[envKey];
  if (!appId) return [];

  const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(name)}/events?app_id=${encodeURIComponent(appId)}&date=upcoming`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bandsintown API for ${name} failed: ${res.status} ${res.statusText}`);
  }
  const events = await res.json();

  return events.map((e) => ({
    artist: name,
    date: e.datetime,
    venue: e.venue?.name ?? null,
    city: e.venue?.city ?? null,
    country: e.venue?.country ?? null,
    url: e.url,
  }));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let upcoming = [];
  for (const artist of ARTISTS) {
    try {
      upcoming.push(...(await fetchUpcoming(artist)));
    } catch (err) {
      console.warn(`[fetch-gigs] skipping ${artist.name}: ${err.message}`);
    }
  }

  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

  const data = {
    fetchedAt: new Date().toISOString(),
    upcoming,
  };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(`[fetch-gigs] wrote ${data.upcoming.length} upcoming gigs to ${OUT_FILE.pathname}`);
}

main();
