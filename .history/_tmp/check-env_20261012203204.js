const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t(a INTEGER)');
db.prepare('INSERT INTO t(a) VALUES (?)').run(42);
const row = db.prepare('SELECT a FROM t').get();
console.log('SQLITE_OK', row.a);
