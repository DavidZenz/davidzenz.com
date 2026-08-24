# davidzenz.com

Static portfolio site, built with [Eleventy](https://www.11ty.dev/). No server-side code runs at request time — everything is generated at build time in GitHub Actions and deployed to GitHub Pages.

## Local development

```bash
npm install
npm start        # fetches GitHub data, builds, serves with live reload
```

## Editing content

Most content lives in plain JSON under `src/_data/`:

- `site.json` — global metadata, nav, social links (some are `null` placeholders — fill in real handles).
- `professional.json` — bio, experience, education (from the wiiw profile).
- `publications.json` — publications/projects list.
- `music.json` — bands, training timeline, stats (**stats are stale placeholders**, update them).
- `running.json` — PBs (**placeholders**, verify/correct times).
- `github.json` — **generated automatically** by `scripts/fetch-github.mjs`, don't hand-edit.

Pages themselves are the `.njk` files directly under `src/`.

## Deferred / TODO

- **Imprint** (`src/imprint.njk`) — fill in legal name/address before going live (Austrian legal requirement).
- **Strava integration** — register a Strava API app, do a one-time OAuth authorization to get a refresh token, add it as a GitHub Actions secret, then add a `scripts/fetch-strava.mjs` following the same pattern as `fetch-github.mjs`. Wire its output into `src/running.njk`.
- **Social links** in `site.json` (LinkedIn, Instagram, Strava) — currently `null`, GitHub is verified.
- **DNS cutover** — once ready to go live, point `davidzenz.com` DNS at GitHub Pages (A records to GitHub's IPs, or CNAME for a `www` subdomain) at your DNS provider. The `CNAME` file in this repo is already set to `davidzenz.com`.
- Repo needs to be **public** on GitHub for the free-tier custom domain on GitHub Pages to work.

## Deploy

Push to `main` — GitHub Actions builds and deploys to GitHub Pages automatically (also runs daily via cron to refresh GitHub activity data).
