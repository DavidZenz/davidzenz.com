import { readdir, mkdir } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import sharp from "sharp";

const SRC_DIR = new URL("../images-src/", import.meta.url);
const OUT_DIR = new URL("../src/assets/images/", import.meta.url);

const WIDTH = 1000;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) =>
    [".jpg", ".jpeg", ".png"].includes(extname(f).toLowerCase())
  );

  for (const file of files) {
    const name = basename(file, extname(file));
    const input = sharp(new URL(file, SRC_DIR).pathname).resize({
      width: WIDTH,
      withoutEnlargement: true,
    });

    await input
      .clone()
      .avif({ quality: 55 })
      .toFile(join(new URL(OUT_DIR).pathname, `${name}.avif`));

    await input
      .clone()
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(new URL(OUT_DIR).pathname, `${name}.jpg`));

    console.log(`[build-images] ${file} -> ${name}.avif + ${name}.jpg`);
  }
}

main();
