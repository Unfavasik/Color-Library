import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

console.log('📦 Building Color Library for production (Vercel & static hosting)...');

// 1. Clean and re-create dist/ directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Core application assets to copy from root
const coreFiles = [
  'index.html',
  'htmcolor.html',
  'ch.css',
  'ch.js',
  'ch.woff2',
  'color-library.png',
  'favicon.ico',
  'favicon.svg',
  'favicon.png',
  'og-image.webp',
  'vercel.json',
  'ads.txt'
];

for (const file of coreFiles) {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(DIST_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// 3. Copy everything from public/ directly to dist/ and also to dist/public/
if (fs.existsSync(PUBLIC_DIR)) {
  const distPublicDir = path.join(DIST_DIR, 'public');
  if (!fs.existsSync(distPublicDir)) {
    fs.mkdirSync(distPublicDir, { recursive: true });
  }
  const publicEntries = fs.readdirSync(PUBLIC_DIR);
  for (const entry of publicEntries) {
    const src = path.join(PUBLIC_DIR, entry);
    const dest = path.join(DIST_DIR, entry);
    const destInPublic = path.join(distPublicDir, entry);
    const stat = fs.statSync(src);
    if (stat.isFile()) {
      fs.copyFileSync(src, dest);
      fs.copyFileSync(src, destInPublic);
    } else if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
      fs.cpSync(src, destInPublic, { recursive: true });
    }
  }
}

// 4. Verify critical files in dist/
const requiredFiles = [
  'index.html',
  'ch.css',
  'ch.js',
  '_redirects',
  '_headers',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'favicon.ico',
  'favicon.svg',
  'favicon.png',
  'og-image.webp',
  'ads.txt'
];

console.log('\n📄 Production Output Files (dist/):');
const distFiles = fs.readdirSync(DIST_DIR);
for (const file of distFiles) {
  const filePath = path.join(DIST_DIR, file);
  const size = (fs.statSync(filePath).size / 1024).toFixed(2);
  console.log(`  ✓ ${file.padEnd(24)} (${size} KB)`);
}

let missing = false;
for (const req of requiredFiles) {
  if (!fs.existsSync(path.join(DIST_DIR, req))) {
    console.error(`  ❌ Missing required production file: ${req}`);
    missing = true;
  }
}

if (missing) {
  console.error('\n❌ Build failed: Some required production files are missing.');
  process.exit(1);
}

console.log('\n✨ Build complete! Output directory: dist/\nReady for Vercel deployment (and static hosting).');
