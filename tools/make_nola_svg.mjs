/* Builds art/nola-summit.svg: the app's New Orleans summit art (nolaArt in index.html) as one self-contained,
   animated SVG the website can use for its summit header. Run: node tools/make_nola_svg.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const a = html.indexOf('function nolaArt('), b = html.indexOf('/* summit art: New Orleans gets its own');
const css = html.slice(html.indexOf('.nola .no-stars circle{'), html.indexOf('\n', html.indexOf('@keyframes no-car{')) + 1);
const nolaArt = new Function('var ART_N = 0;\n' + html.slice(a, b) + '\nreturn nolaArt;')();
let svg = nolaArt({ align: 'xMaxYMax' }).replace(' class="hero-art nola"', ' class="nola" xmlns="http://www.w3.org/2000/svg" role="img"');
svg = svg.replace('<defs>', '<title>New Orleans at night: the French Quarter, St. Louis Cathedral and a St. Charles streetcar</title><defs><style>' +
  css.replace(/\s*\n\s*/g, ' ') + ' @media (prefers-reduced-motion: reduce){ .nola *{animation:none !important} }</style>');
writeFileSync('art/nola-summit.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + '\n');
console.log('art/nola-summit.svg', svg.length, 'bytes');
