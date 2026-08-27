import { readFile, writeFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

const TAXONOMY_FILE = new URL("./project-topics.taxonomy.json", import.meta.url);
const OUT_FILE = new URL("../src/_data/projectTopics.json", import.meta.url);

// Split anchor: every project in the PDF carries a "Month YYYY - Month YYYY" line.
const PERIOD_RE = /([A-Z][a-z]+)\s+(\d{4})\s*[-–]\s*([A-Z][a-z]+)\s+(\d{4})/g;

function cleanPdfText(raw) {
  return raw
    // page footer: "Thursday, 27 August 2026        3/10"
    .replace(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}/g, " ")
    .replace(/\b\d{1,2}\s*\/\s*10\b/g, " ")
    // running header
    .replace(/https?:\/\/\S*wiiw\.ac\.at\S*/gi, " ")
    .replace(/Wiener Institut für Internationale Wirtschaftsvergleiche/gi, " ")
    .replace(/The Vienna Institute for International Economic Studies/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Break the document into one text block per project, using the period line as the boundary. */
function splitProjects(text) {
  const matches = [...text.matchAll(PERIOD_RE)];
  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks.push(text.slice(start, end).trim());
  }
  const years = matches.flatMap((m) => [Number(m[2]), Number(m[4])]).filter(Boolean);
  return {
    blocks,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
  };
}

function scoreTopics(blocks, taxonomy) {
  const minCount = taxonomy.minCount ?? 2;

  const ranked = taxonomy.topics
    .map((topic) => {
      const res = topic.patterns.map((p) => new RegExp(p, "i"));
      const count = blocks.filter((b) => res.some((re) => re.test(b))).length;
      return { label: topic.label, count };
    })
    .filter((t) => t.count >= minCount)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Weight = tercile by rank (self-calibrating as counts drift year to year).
  // Boundary counts are inclusive so ties land in the higher tier.
  const n = ranked.length;
  const highCut = ranked[Math.floor(n / 3)]?.count ?? 0;
  const midCut = ranked[Math.floor((2 * n) / 3)]?.count ?? 0;

  return ranked.map((t) => ({
    label: t.label,
    count: t.count,
    weight: t.count >= highCut ? 3 : t.count >= midCut ? 2 : 1,
  }));
}

async function main() {
  const taxonomy = JSON.parse(await readFile(TAXONOMY_FILE, "utf8"));

  let existing = null;
  try {
    existing = JSON.parse(await readFile(OUT_FILE, "utf8"));
  } catch {
    /* first run */
  }

  let pdfBytes;
  try {
    const res = await fetch(taxonomy.source);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    pdfBytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.warn(`[fetch-project-topics] download failed, keeping existing topics: ${err.message}`);
    if (!existing) process.exitCode = 1;
    return;
  }

  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const { blocks, minYear, maxYear } = splitProjects(cleanPdfText(text));

  if (blocks.length < 10) {
    console.warn(`[fetch-project-topics] only ${blocks.length} project blocks parsed, keeping existing topics`);
    if (!existing) process.exitCode = 1;
    return;
  }

  const topics = scoreTopics(blocks, taxonomy);
  if (topics.length === 0) {
    console.warn("[fetch-project-topics] no topics cleared the minimum count, keeping existing topics");
    if (!existing) process.exitCode = 1;
    return;
  }

  const span = minYear && maxYear ? ` (${minYear}–${maxYear})` : "";
  const data = {
    note: `Recurring themes across ${blocks.length} wiiw research projects${span}, ordered by how often they appear.`,
    source: taxonomy.source,
    fetchedAt: new Date().toISOString(),
    projectCount: blocks.length,
    topics,
  };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2) + "\n");

  const summary = topics.map((t) => `${t.label} (${t.count}, w${t.weight})`).join(", ");
  console.log(`[fetch-project-topics] ${blocks.length} projects -> ${topics.length} topics: ${summary}`);
}

main();
