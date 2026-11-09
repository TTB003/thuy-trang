const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');

function unaccent(text) {
  if (text === null || text === undefined) return null;
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

let ok = 'NO';
try {
  db.function('UNACCENT', { deterministic: true }, unaccent);
  ok = 'YES';
} catch (e) {
  ok = 'ERR:' + e.message;
}
console.log('function() supported:', ok);

if (ok === 'YES') {
  db.exec('CREATE TABLE t(name TEXT, price DECIMAL(18,2), qty INTEGER)');
  db.prepare('INSERT INTO t VALUES (?, ?, ?)').run('Cà phê Sữa Đá', 29000, 5);
  db.prepare('INSERT INTO t VALUES (?, ?, ?)').run('Trà Đào Cam Sả', 45000, 12);
  const rows = db
    .prepare("SELECT name, price, qty, typeof(price) AS tp, typeof(qty) AS tq FROM t WHERE UNACCENT(name) LIKE UNACCENT(?)")
    .all('%ca phe%');
  console.log('search result:', JSON.stringify(rows));
}
