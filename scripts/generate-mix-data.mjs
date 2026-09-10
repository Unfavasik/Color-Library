import fs from 'node:fs';
import path from 'node:path';

const anchors = [
  ['Cobalt', 220, 78, 57], ['Violet', 268, 76, 64], ['Coral', 10, 86, 64], ['Amber', 39, 94, 61],
  ['Mint', 164, 66, 60], ['Rose', 337, 79, 67], ['Ocean', 198, 83, 49], ['Lime', 91, 71, 55],
  ['Indigo', 245, 61, 43], ['Tangerine', 24, 92, 60], ['Sky', 204, 78, 67], ['Plum', 291, 57, 49]
];
const names = ['Studio', 'Sunset', 'Aurora', 'Signal', 'Bloom', 'Tide', 'Dawn', 'Orbit', 'Muse', 'Canvas'];
const styles = ['Vibrant', 'Soft', 'Editorial', 'Electric', 'Earthy', 'Minimal'];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};
const hash = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
const data = [];
for (let i = 0; i < 10000; i++) {
  const a = anchors[i % anchors.length];
  const drift = Math.abs(hash(i + 1));
  const harmony = (i % 5) * 24 + (i % 3) * 7;
  const base = (a[1] + harmony + Math.floor(drift * 16)) % 360;
  const style = styles[i % styles.length];
  const colors = [0, 1, 2, 3, 4].map((slot) => {
    const hue = (base + slot * (22 + (i % 4) * 7) + Math.floor(Math.abs(hash(i * 7 + slot)) * 12)) % 360;
    const sat = clamp(a[2] - slot * 7 + Math.floor(Math.abs(hash(i * 5 + slot)) * 14), 38, 96);
    const light = clamp(a[3] + (slot - 2) * 8 + Math.floor(Math.abs(hash(i * 3 + slot)) * 10 - 5), 24, 84);
    return hslToHex(hue, sat, light);
  });
  data.push({ id: i + 1, name: `${a[0]} ${names[i % names.length]}`, style, score: 92 - (i % 19) / 10, colors });
}
const out = path.resolve('public/mix-data.js');
fs.writeFileSync(out, `window.MIX_LIBRARY = ${JSON.stringify(data)};\n`);
console.log(`Wrote ${data.length} combinations to ${out}`);
