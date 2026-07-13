import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const fullIconSvg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect x="0" y="0" width="${s}" height="${s}" rx="${s*0.18}" fill="#FF8A3D"/>
  <text x="${s/2}" y="${s*0.72}" font-family="sans-serif" font-size="${s*0.52}" font-weight="bold" fill="white" text-anchor="middle">₹</text>
</svg>`;

const fgSvg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <text x="${s/2}" y="${s*0.72}" font-family="sans-serif" font-size="${s*0.52}" font-weight="bold" fill="white" text-anchor="middle">₹</text>
</svg>`;

async function generate() {
  for (const [dir, size] of Object.entries(sizes)) {
    const outDir = `android/app/src/main/res/${dir}`;
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const png = await sharp(Buffer.from(fullIconSvg(size))).resize(size, size).png().toBuffer();
    writeFileSync(`${outDir}/ic_launcher.png`, png);
    writeFileSync(`${outDir}/ic_launcher_round.png`, png);

    const fgPng = await sharp(Buffer.from(fgSvg(size))).resize(size, size).png().toBuffer();
    writeFileSync(`${outDir}/ic_launcher_foreground.png`, fgPng);

    console.log(`Generated ${dir} (${size}x${size})`);
  }
  console.log('Done!');
}

generate().catch(console.error);
