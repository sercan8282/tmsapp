/**
 * Generate PWA Icons Script
 * Run with: node scripts/generate-icons.js
 * 
 * Note: This creates placeholder PNG files. For production, 
 * replace these with properly designed icons or use a tool like:
 * - https://realfavicongenerator.net
 * - https://www.pwabuilder.com/imageGenerator
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../frontend/public/icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Simple SVG icon template
const createSvgIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2d5a8f;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Arial, sans-serif" font-size="${size * 0.35}" font-weight="bold" fill="white">
    TMS
  </text>
</svg>
`;

console.log('Generating PWA icons...');

sizes.forEach(size => {
  const svgContent = createSvgIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svgContent.trim());
  console.log(`Created: ${filename}`);
});

console.log('\\nIcons generated successfully!');
console.log('\\nNote: These are SVG placeholders. For production, convert to PNG using:');
console.log('- Online: https://realfavicongenerator.net');
console.log('- CLI: npx pwa-asset-generator');
console.log('- Or use sharp/canvas in Node.js');
