import { writeFile, mkdir } from "node:fs/promises";

const USERNAME = "davidzenz";
const OUT_DIR = new URL("../src/_data/", import.meta.url);
const OUT_FILE = new URL("github.json", OUT_DIR);

const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "davidzenz-website-build",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let repos = [];
  let user = null;
  try {
    user = await fetchJson(`https://api.github.com/users/${USERNAME}`);
    repos = await fetchJson(
      `https://api.github.com/users/${USERNAME}/repos?sort=pushed&per_page=12&type=owner`
    );
  } catch (err) {
    console.warn(`[fetch-github] falling back to empty data set: ${err.message}`);
  }

  const data = {
    fetchedAt: new Date().toISOString(),
    user: user
      ? {
          login: user.login,
          name: user.name,
          bio: user.bio,
          publicRepos: user.public_repos,
          followers: user.followers,
          htmlUrl: user.html_url,
        }
      : null,
    repos: repos
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
        pushedAt: r.pushed_at,
      })),
  };

  await writeFile(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(`[fetch-github] wrote ${data.repos.length} repos to ${OUT_FILE.pathname}`);
}

main();
