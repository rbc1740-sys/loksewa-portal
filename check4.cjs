const fs = require('fs');
const c = fs.readFileSync('D:\\loksewa-portal\\app.html', 'utf8');
console.log('id=tab-practice:', (c.match(/id="tab-practice"/g) || []).length);
console.log('id=tab-exam:', (c.match(/id="tab-exam"/g) || []).length);
console.log('id=tab-battle:', (c.match(/id="tab-battle"/g) || []).length);
console.log('id=tab-revision:', (c.match(/id="tab-revision"/g) || []).length);
console.log('id=tab-manage:', (c.match(/id="tab-manage"/g) || []).length);
console.log('id=tab-spaced:', (c.match(/id="tab-spaced"/g) || []).length);