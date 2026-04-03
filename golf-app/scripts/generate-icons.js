// Generates PWA icons as PNG files using pure Node.js (no canvas dependency)
// Creates simple SVG-based icons and saves them

const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

// SVG icon — golf flag on green background
function makeSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#052e16"/>
  <text x="50%" y="54%" font-size="${size * 0.55}" text-anchor="middle" dominant-baseline="middle">⛳</text>
</svg>`;
}

// Save SVGs (Railway/browsers can use SVG icons too)
fs.writeFileSync(path.join(iconDir, 'icon-192.svg'), makeSVG(192));
fs.writeFileSync(path.join(iconDir, 'icon-512.svg'), makeSVG(512));

// Also write PNG placeholders using raw PNG bytes for a solid green square with emoji
// Since we can't use canvas without native deps, we'll use SVG as the icon source
// and update manifest to use SVG

console.log('Icons generated in public/icons/');
