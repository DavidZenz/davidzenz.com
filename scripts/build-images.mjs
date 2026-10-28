import { readdir, mkdir } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import sharp from "sharp";

const SRC_DIR = new URL("../images-src/", import.meta.url);
const OUT_DIR = new URL("../src/assets/images/", import.meta.url);

const COVERS_SRC_DIR = new URL("covers/", SRC_DIR);
const COVERS_OUT_DIR = new URL("covers/", OUT_DIR);

const PORTRAIT_WIDTH = 1000;
const LANDSCAPE_HEIGHT = 1100;
const COVER_SIZE = 480;

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
  await mkdir(COVERS_OUT_DIR, { recursive: true });
  const covers = (await readdir(COVERS_SRC_DIR)).filter((f) =>
    [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase())
  );

  for (const file of covers) {
    const name = basename(file, extname(file));
    const input = sharp(new URL(file, COVERS_SRC_DIR).pathname).resize(COVER_SIZE, COVER_SIZE, {
      fit: "cover",
      withoutEnlargement: true,
    });

    await input
      .clone()
      .avif({ quality: 64 })
      .toFile(join(new URL(COVERS_OUT_DIR).pathname, `${name}.avif`));

    await input
      .clone()
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(join(new URL(COVERS_OUT_DIR).pathname, `${name}.jpg`));

    console.log(`[build-images] covers/${file} -> covers/${name}.avif + covers/${name}.jpg`);
  }
}

main();
