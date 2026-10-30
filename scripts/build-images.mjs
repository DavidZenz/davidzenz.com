import { readdir, mkdir } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import sharp from "sharp";

const SRC_DIR = new URL("../images-src/", import.meta.url);
const OUT_DIR = new URL("../src/assets/images/", import.meta.url);

const PORTRAIT_WIDTH = 1000;
const LANDSCAPE_HEIGHT = 1100;
const COVER_SIZE = 480;
const AWARD_WIDTH = 1080;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) =>
    [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase())
  );

  for (const file of files) {
    const name = basename(file, extname(file));
    const srcPath = new URL(file, SRC_DIR).pathname;
    const meta = await sharp(srcPath).metadata();
    const isLandscape = meta.width > meta.height;
    const resizeOpts = isLandscape
      ? { height: LANDSCAPE_HEIGHT, withoutEnlargement: true }
      : { width: PORTRAIT_WIDTH, withoutEnlargement: true };
    const input = sharp(srcPath).resize(resizeOpts);

    await input
      .clone()
      .avif({ quality: 72 })
      .toFile(join(new URL(OUT_DIR).pathname, `${name}.avif`));

    await input
      .clone()
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(new URL(OUT_DIR).pathname, `${name}.jpg`));

    console.log(`[build-images] ${file} -> ${name}.avif + ${name}.jpg`);
  }

  // Release covers: small square thumbnails for the music page
  await buildSubdir("covers", { width: COVER_SIZE, height: COVER_SIZE, fit: "cover", withoutEnlargement: true });

  // Award logos and graphics: keep aspect ratio
  await buildSubdir("awards", { width: AWARD_WIDTH, withoutEnlargement: true });
}

async function buildSubdir(dir, resizeOpts) {
  const srcDir = new URL(`${dir}/`, SRC_DIR);
  const outDir = new URL(`${dir}/`, OUT_DIR);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(srcDir)).filter((f) =>
    [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase())
  );

  for (const file of files) {
    const name = basename(file, extname(file));
    const input = sharp(new URL(file, srcDir).pathname).resize(resizeOpts);

    await input
      .clone()
      .avif({ quality: 64 })
      .toFile(join(outDir.pathname, `${name}.avif`));

    await input
      .clone()
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(join(outDir.pathname, `${name}.jpg`));

    console.log(`[build-images] ${dir}/${file} -> ${dir}/${name}.avif + ${dir}/${name}.jpg`);
  }
}

main();
