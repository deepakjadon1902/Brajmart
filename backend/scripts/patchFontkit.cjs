// fontkit 2.0.4 crashes on valid NULL GPOS anchors in bundled Noto fonts (e.g. रे).
// https://github.com/foliojs/fontkit/issues/367
// Skip that subtable so later subtables can still position the mark. Keep all
// other shaping enabled. Remove this patch when upgrading to an upstream fix.
const fs = require('node:fs');
const path = require('node:path');

const entry = require.resolve('fontkit');
const root = path.resolve(path.dirname(entry), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '2.0.4') throw new Error(`Review the invoice fontkit patch before using version ${version}`);

const guard = 'if (baseAnchor == null || markRecord.markAnchor == null) return false;';
const anchor = /(let baseAnchor = (?:table\.baseArray\[baseIndex\]|ligAttach\[compIndex\]|table\.mark2Array\[mark2Index\])\[markRecord\.class\];)(\r?\n)([ \t]*)(this\.applyAnchor\(markRecord, baseAnchor, (?:baseGlyphIndex|prevIndex)\);)/g;
for (const file of [entry, path.join(root, 'src/opentype/GPOSProcessor.js')]) {
  const original = fs.readFileSync(file, 'utf8');
  if (original.split(guard).length - 1 === 3) continue;
  let count = 0;
  const patched = original.replace(anchor, (_, declaration, newline, indent, apply) => {
    count++;
    return `${declaration}${newline}${indent}${guard}${newline}${indent}${apply}`;
  });
  if (count !== 3) throw new Error(`Unable to safely apply the invoice fontkit patch to ${path.basename(file)}`);
  fs.writeFileSync(file, patched);
}
