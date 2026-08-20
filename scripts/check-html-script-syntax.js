#!/usr/bin/env node
// Extracts every inline <script> block (no src=) from the given HTML file(s)
// and checks each for syntax errors, without executing any of it.
// This automates the manual `node --check` step already done by hand
// before most commits in this repo.

const fs = require('fs');
const vm = require('vm');

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: node scripts/check-html-script-syntax.js <file.html> [file2.html ...]');
  process.exit(1);
}

const scriptBlockPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

let hasError = false;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  let match;
  let count = 0;

  scriptBlockPattern.lastIndex = 0;
  while ((match = scriptBlockPattern.exec(html)) !== null) {
    count += 1;
    const code = match[1];
    try {
      new vm.Script(code, { filename: `${file}#inline-script-${count}` });
    } catch (err) {
      hasError = true;
      const start = Math.max(0, code.length - 200);
      console.error(`Syntax error in ${file} (inline <script> #${count}): ${err.message}`);
      console.error(`  block length: ${code.length} chars`);
      console.error(`  last 200 chars of block: ${JSON.stringify(code.slice(start))}`);
    }
  }

  console.log(`${file}: checked ${count} inline <script> block(s)`);
}

process.exit(hasError ? 1 : 0);
