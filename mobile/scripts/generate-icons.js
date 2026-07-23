/**
 * Genera icon.png, splash-icon.png, adaptive-icon.png y favicon.png
 * con el corazón morado de +VIDA (#5B4FCF).
 */
const path = require('path');
const sharp = require(path.join(__dirname, '../../backend/node_modules/sharp'));

const PURPLE = '#5B4FCF';
const WHITE = '#FFFFFF';
const OUT_DIR = path.join(__dirname, '../assets/images');

function heartSvg(size, color, paddingRatio = 0.2) {
  const pad = size * paddingRatio;
  const scale = (size - pad * 2) / 24;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${pad}, ${pad + scale * 0.5}) scale(${scale})">
    <path fill="${color}" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </g>
</svg>`;
}

function solidSvg(size, color) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
</svg>`;
}

async function compositeIcon({ size, bg, heartColor, paddingRatio, outFile }) {
  const heart = Buffer.from(heartSvg(size, heartColor, paddingRatio));
  const layers = [{ input: await sharp(heart).png().toBuffer() }];

  if (bg) {
    const base = Buffer.from(solidSvg(size, bg));
    await sharp(base).composite(layers).png().toFile(outFile);
  } else {
    await sharp(heart).png().toFile(outFile);
  }
}

async function main() {
  await compositeIcon({
    size: 1024,
    bg: PURPLE,
    heartColor: WHITE,
    paddingRatio: 0.22,
    outFile: path.join(OUT_DIR, 'icon.png'),
  });

  await compositeIcon({
    size: 1024,
    bg: null,
    heartColor: WHITE,
    paddingRatio: 0.12,
    outFile: path.join(OUT_DIR, 'splash-icon.png'),
  });

  await compositeIcon({
    size: 1024,
    bg: null,
    heartColor: WHITE,
    paddingRatio: 0.18,
    outFile: path.join(OUT_DIR, 'adaptive-icon.png'),
  });

  await compositeIcon({
    size: 192,
    bg: PURPLE,
    heartColor: WHITE,
    paddingRatio: 0.22,
    outFile: path.join(OUT_DIR, 'favicon.png'),
  });

  console.log('Iconos generados en', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
