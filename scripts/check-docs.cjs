'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git','node_modules','release'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.md')) files.push(file);
  }
}
walk(root);
let checked = 0;
const problems = [];
for (const file of files) {
  const body = fs.readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '').replace(/`[^`\n]*`/g, '');
  for (const match of body.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
    const reference = match[1] || match[2];
    if (/^(https?:|mailto:|#)/i.test(reference)) continue;
    const local = decodeURIComponent(reference.split('#')[0]);
    if (!local) continue;
    const resolved = path.resolve(path.dirname(file), local);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) problems.push(`${path.relative(root,file)}: link leaves repository: ${reference}`);
    else if (!fs.existsSync(resolved)) problems.push(`${path.relative(root,file)}: missing ${reference}`);
    checked++;
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Documentation verified: ${files.length} Markdown files, ${checked} local references.`);
