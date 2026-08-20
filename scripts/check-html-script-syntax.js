#!/usr/bin/env node
// Extracts every executable inline <script> block (no src=, and no non-JS
// type= such as text/plain or application/octet-stream used to embed base64
// data blobs) from the given HTML file(s) and checks each for syntax errors,
// without executing any of it. This automates the manual `node --check` step
// already done by hand before most commits in this repo.

const fs = require('fs');
const vm = require('vm');

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: node scripts/check-html-script-syntax.js <file.html> [file2.html ...]');
  process.exit(1);
}

const scriptTagPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const jsTypePattern = /^(text\/javascript|application\/javascript|application\/ecmascript|text\/ecmascript|module)$/i;

function isExecutableScript(attrs) {
  if (/\bsrc\s*=/i.test(attrs)) return false;
  const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
  if (!typeMatch) return true; // no type= attribute defaults to JavaScript
  const type = (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3] ?? '').trim();
  if (type === '') return true;
  return jsTypePattern.test(type);
}

let hasError = false;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  let match;
  let checked = 0;
  let skipped = 0;

  scriptTagPattern.lastIndex = 0;
  while ((match = scriptTagPattern.exec(html)) !== null) {
    const [, attrs, code] = match;
    if (!isExecutableScript(attrs)) {
      skipped += 1;
      continue;
    }
    checked += 1;
    try {
      new vm.Script(code, { filename: `${file}#inline-script-${checked}` });
    } catch (err) {
      hasError = true;
      console.error(`Syntax error in ${file} (inline <script> #${checked}): ${err.message}`);
    }
  }

  console.log(`${file}: checked ${checked} inline <script> block(s), skipped ${skipped} non-JS block(s)`);
}

process.exit(hasError ? 1 : 0);
