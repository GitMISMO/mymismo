/* Builds the website copies of the app's summit art, each one self-contained, animated SVG the website uses for its
   summit header: art/nola-summit.svg (nolaArt in index.html) and art/slc-summit.svg (slcArt).
   Run: node tools/make_nola_svg.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const a = html.indexOf('function nolaArt('), b = html.indexOf('/* summit art:');
const css = html.slice(html.indexOf('.nola .no-stars circle{'), html.indexOf('\n', html.indexOf('@keyframes no-car{')) + 1);
const art = new Function('var ART_N = 0;\n' + html.slice(a, b) + '\nreturn { nola: nolaArt, slc: slcArt };')();
for (const [file, fn, title] of [
  ['art/nola-summit.svg', art.nola, 'New Orleans at night: the French Quarter and a St. Charles streetcar'],
  ['art/slc-summit.svg', art.slc, 'Salt Lake City at night: the Wasatch Range, downtown, the Utah State Capitol and a TRAX train']]) {
  let svg = fn({ align: 'xMaxYMax' }).replace(/ class="hero-art (nola[^"]*)"/, ' class="$1" xmlns="http://www.w3.org/2000/svg" role="img"');
  svg = svg.replace('<defs>', '<title>' + title + '</title><defs><style>' +
    css.replace(/\s*\n\s*/g, ' ') + ' @media (prefers-reduced-motion: reduce){ .nola *{animation:none !important} }</style>');
  writeFileSync(file, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + '\n');
  console.log(file, svg.length, 'bytes');
}
