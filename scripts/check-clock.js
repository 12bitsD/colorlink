const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../apps/clock/index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
if (inlineScripts.length === 0) throw new Error('No inline clock script found');
for (const [index, match] of inlineScripts.entries()) {
  try {
    new Function(match[1]);
  } catch (error) {
    throw new Error(`Clock inline script ${index + 1}: ${error.message}`);
  }
}
console.log(`Clock syntax OK (${inlineScripts.length} inline script)`);
