const fs = require('fs');
const html = fs.readFileSync('d:/loksewa-portal/app.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  if (/src\s*=/.test(attrs)) continue; // external scripts
  const code = m[2];
  i++;
  try {
    new Function(code);
  } catch (e) {
    errors++;
    console.log('SCRIPT #' + i + ' SYNTAX ERROR: ' + e.message);
  }
}
console.log('Checked inline scripts: ' + i + ', errors: ' + errors);
