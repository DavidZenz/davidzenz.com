import { readFile, writeFile } from "node:fs/promises";

const PROFILE_URL = "https://wiiw.ac.at/david-zenz-s-1199.html";
const BASE_URL = "https://wiiw.ac.at/";
const OUT_FILE = new URL("../src/_data/publications.json", import.meta.url);

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTH_NUM = Object.fromEntries(MONTHS.split("|").map((m, i) => [m, i + 1]));
const DATE_RE = new RegExp(`(${MONTHS})\\s+(\\d{4})`);

// wiiw section heading -> key in publications.json
const SECTION_MAP = {
  "Articles in refereed journals": "peerReviewed",
  "wiiw Handbook of Statistics": "books",
  "wiiw Statistical Reports": "workingPapers",
  "wiiw Working Papers": "workingPapers",
};
const FALLBACK_KEY = "shorterArticles"; // Monthly Reports, Opinion Pieces, Policy Notes, ...
const MANAGED = ["peerReviewed", "books", "workingPapers", "shorterArticles"];

const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&ouml;/g, "ö").replace(/&auml;/g, "ä").replace(/&uuml;/g, "ü").replace(/&szlig;/g, "ß")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** "A, B and C" -> "A, B, and C" (Oxford comma, matches the site's style). */
const oxford = (s) => s.replace(/,?\s+and\s+(?=[^,]+$)/, (m, off, str) => (str.slice(0, off).includes(",") ? ", and " : " and "));

const absUrl = (href) => (/^https?:/.test(href) ? href : BASE_URL + href.replace(/^\.?\//, ""));
const dateKey = (d) => {
  const m = DATE_RE.exec(d || "");
  return m ? Number(m[2]) * 100 + MONTH_NUM[m[1]] : 0;
};

function parseItem(li) {
  const href = /<a\s+[^>]*href="([^"]+)"[^>]*>\s*<img/i.exec(li)?.[1];
  const html = li.replace(/<a\s[^>]*>\s*<img[^>]*>\s*<\/a>/gi, "").trim();

  const titleM = /^'(.*?)'(?=\s*(?:\(with|,|<i>|$))/s.exec(html);
  if (!titleM) return null;
  const title = strip(titleM[1]);
  let rest = html.slice(titleM[0].length);

  const withM = /^\s*\(with ([^)]+)\)/.exec(rest);
  if (withM) rest = rest.slice(withM[0].length);
  const coauthors = withM ? oxford(strip(withM[1])) : null;

  const text = strip(rest).replace(/^,\s*/, "");
  const editor = /^(?:in:\s*)?([^,<]+?)\s*\(eds?\)/.exec(text)?.[1] ?? null;
  const series = strip(/<i>(.*?)<\/i>/.exec(rest)?.[1] ?? "").replace(/^,\s*/, "");
  const afterSeries = strip(rest.slice(rest.indexOf("</i>") + 4)).replace(/^,\s*/, "");
  const date = DATE_RE.exec(afterSeries)?.[0] ?? DATE_RE.exec(text)?.[0] ?? null;
  const number = /^No\.\s*([\w./-]+)/.exec(afterSeries)?.[1] ?? null;
  const pages = /pp?\.\s*([\d]+\s*[-–]\s*[\d]+|\d+)/.exec(afterSeries)?.[0]?.replace(/\s*-\s*/, "–") ?? null;
  // journals: "<i>Journal</i>, 13, 17, October 2024" -> volume "13, Article 17"
  const volParts = (afterSeries.split(DATE_RE)[0] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const monthlyNo = /Monthly Report No\.\s*(\d+\/\d{4})/.exec(text)?.[1];

  return { title, coauthors, editor, series, number, pages, date, volParts, monthlyNo, url: href ? absUrl(href) : null };
}

function build(key, it, sectionName) {
  if (key === "peerReviewed") {
    const [vol, art] = it.volParts;
    return {
      title: it.title,
      authors: it.coauthors ? `with ${it.coauthors}` : "",
      venue: it.series,
      ...(vol ? { volume: art ? `${vol}, Article ${art}` : vol } : {}),
      date: it.date,
      url: it.url,
    };
  }
  if (key === "books") {
    const note = [it.coauthors && `with ${it.coauthors.replace(/,? and /, ", ")}`, it.editor && `editor: ${it.editor}`]
      .filter(Boolean).join("; ");
    return { title: it.title.split(":")[0].trim(), ...(note ? { note } : {}), date: it.date };
  }
  if (key === "workingPapers") {
    const tail = [it.series, it.number && `No. ${it.number}`].filter(Boolean).join(" ");
    return { title: it.title, note: [it.coauthors && `with ${it.coauthors}`, tail].filter(Boolean).join(" — "), date: it.date };
  }
  const venue = it.monthlyNo
    ? `${it.series} No. ${it.monthlyNo}`
    : it.number ? `${it.series} No. ${it.number}` : `${it.series}, Vienna`;
  const note = [it.coauthors && `with ${it.coauthors}`, it.pages, it.editor && `editor: ${it.editor}`].filter(Boolean).join(", ");
  return { title: it.title, venue, ...(note ? { note } : {}), date: it.date, url: it.url };
}

async function main() {
  const res = await fetch(PROFILE_URL);
  if (!res.ok) throw new Error(`wiiw profile fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();

  // each section: <b><a name="slug">Heading</a></b> <ul> <li>…</li> </ul>
  const sectionRe = /<b><a name="[^"]+">([^<]+)<\/a><\/b>\s*<ul>([\s\S]*?)<\/ul>/g;
  const out = Object.fromEntries(MANAGED.map((k) => [k, []]));
  let parsedSections = 0;

  for (const [, rawName, body] of html.matchAll(sectionRe)) {
    const name = decode(rawName).trim();
    const key = SECTION_MAP[name] ?? FALLBACK_KEY;
    parsedSections++;
    for (const [, li] of body.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const it = parseItem(li);
      if (!it || !it.date) { console.warn(`Skipping unparseable entry in "${name}": ${strip(li).slice(0, 80)}`); continue; }
      // Handbook "Excel Tables" duplicates the printed Handbook entry
      if (key === "books" && /Excel Tables/i.test(it.title)) continue;
      out[key].push(build(key, it, name));
    }
  }

  if (!parsedSections || MANAGED.every((k) => !out[k].length)) {
    throw new Error("No publications parsed — wiiw page layout may have changed; leaving publications.json untouched.");
  }
  for (const k of MANAGED) out[k].sort((a, b) => dateKey(b.date) - dateKey(a.date));

  // Hand-curated parts (press mentions, documents, notes) are preserved.
  const existing = JSON.parse(await readFile(OUT_FILE, "utf8"));
  const merged = { ...existing, ...out };
  const next = JSON.stringify(merged, null, 2) + "\n";
  if (next === JSON.stringify(existing, null, 2) + "\n") return console.log("Publications unchanged.");
  await writeFile(OUT_FILE, next);
  console.log(`Wrote publications: ${MANAGED.map((k) => `${k}=${out[k].length}`).join(", ")}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
