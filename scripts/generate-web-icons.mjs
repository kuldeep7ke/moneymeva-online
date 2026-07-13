import sharp from 'sharp';
import { writeFileSync } from 'fs';

const sizes = {
  'public/logo.png': 512,
  'public/favicon-32.png': 32,
  'public/icon-192.png': 192,
  'public/icon-512.png': 512,
};

const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect x="0" y="0" width="${s}" height="${s}" rx="${s*0.18}" fill="#FF8A3D"/>
  <text x="${s/2}" y="${s*0.72}" font-family="sans-serif" font-size="${s*0.52}" font-weight="bold" fill="white" text-anchor="middle">₹</text>
</svg>`;

async function generate() {
  for (const [file, size] of Object.entries(sizes)) {
    const png = await sharp(Buffer.from(svg(size))).resize(size, size).png().toBuffer();
    writeFileSync(file, png);
    console.log(`Generated ${file} (${size}x${size})`);
  }
  console.log('Done!');
}

generate().catch(console.error);
