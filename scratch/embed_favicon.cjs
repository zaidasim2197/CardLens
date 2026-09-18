const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'public', 'favicon.png');
const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');

const pngBuf = fs.readFileSync(pngPath);
const b64 = pngBuf.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <image href="data:image/png;base64,${b64}" x="0" y="0" width="128" height="128" />
</svg>
`;

fs.writeFileSync(svgPath, svg, 'utf8');
console.log('Saved public/favicon.svg successfully');
