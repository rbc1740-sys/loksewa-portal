const fs = require('fs');
const APP = 'd:/loksewa-portal/app.html';
let c = fs.readFileSync(APP, 'utf8');
const EOL = c.includes('\r\n') ? '\r\n' : '\n';

function fixAt(c, needle, indent) {
  const at = c.indexOf(needle);
  if (at === -1) {
    console.error('NOT FOUND:', JSON.stringify(needle.slice(0, 40)));
    process.exit(1);
  }
  const before = c[at - 1];
  if (before !== '\n' && before !== '\r') {
    console.error(
      'UNEXPECTED PREV CHAR for:',
      JSON.stringify(needle.slice(0, 30)),
      'prev=',
      JSON.stringify(before)
    );
    process.exit(1);
  }
  return c.replace(needle, indent + needle);
}

c = fixAt(c, 'function selectPracticeAnswer(id, key) {', '      ');
c = fixAt(c, '// Build evaluation feedback header', '        ');
// Multi-line needle (unique to the practice options grid; exam grid also has
// the same div class, so anchor on the following line too).
const gridNeedle =
  '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
  EOL +
  '            ${Object.entries(q.options || {})';
c = fixAt(c, gridNeedle, '          ');

fs.writeFileSync(APP, c, 'utf8');
console.log('Indentation fixed.');
const lines = c.split(EOL);
console.log('line 4282:', JSON.stringify(lines[4281]));
console.log('line 4340:', JSON.stringify(lines[4339]));
console.log('line 4883:', JSON.stringify(lines[4882]));
