// One-off generator for PWA app icons, rasterized from public/favicon.svg.
// Run with: node scripts/generate-icons.mjs
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const webRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const faviconSvg = readFileSync(path.join(webRoot, "public/favicon.svg"), "utf-8");

// Strip the outer <svg ...> wrapper so the mark's paths/mask/defs can be
// re-embedded, scaled and centered, inside a square canvas of any size.
const innerMarkup = faviconSvg
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

const MARK_WIDTH = 48;
const MARK_HEIGHT = 46;

function buildIconSvg({ size, background, fillFraction }) {
  const markWidth = size * fillFraction;
  const scale = markWidth / MARK_WIDTH;
  const scaledWidth = MARK_WIDTH * scale;
  const scaledHeight = MARK_HEIGHT * scale;
  const tx = (size - scaledWidth) / 2;
  const ty = (size - scaledHeight) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)})">
    ${innerMarkup}
  </g>
</svg>`;
}

const targets = [
  { file: "pwa-192.png", size: 192, background: "#ffffff", fillFraction: 0.72 },
  { file: "pwa-512.png", size: 512, background: "#ffffff", fillFraction: 0.72 },
  { file: "maskable-512.png", size: 512, background: "#ffffff", fillFraction: 0.5 },
  { file: "apple-touch-icon.png", size: 180, background: "#ffffff", fillFraction: 0.72 },
];

mkdirSync(path.join(webRoot, "public"), { recursive: true });

for (const target of targets) {
  const svg = buildIconSvg(target);
  const outPath = path.join(webRoot, "public", target.file);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`wrote ${target.file}`);
}
