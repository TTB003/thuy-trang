/** Chẩn đoán lỗi tìm kiếm không dấu trực tiếp qua lớp CSDL. */
'use strict';

const db = require('../src/db');
const dialect = require('../src/db/dialect');

async function main() {
  await db.init();
  console.log('Hệ CSDL:', db.getClient());

  const cauLenh = [];
  cauLenh.push([
    'Ham unaccent_vn co ton tai?',
    `SELECT proname FROM pg_proc WHERE proname = 'unaccent_vn'`,
  ]);
  cauLenh.push(['Goi ham unaccent_vn', `SELECT unaccent_vn('Cà phê sữa đá') AS x`]);
  cauLenh.push([
    'SQL goc cua FilterBuilder',
    `SELECT l.maLoai, l.tenLoai FROM LOAISANPHAM l WHERE (UNACCENT(COALESCE(l.tenLoai, '')) LIKE :s1 OR UNACCENT(COALESCE(l.moTa, '')) LIKE :s1)`,
  ]);

  for (const [nhan, sql] of cauLenh) {
    try {
      const daDich = dialect.sangPostgres(sql);
      const { tenThamSo } = dialect.danhSoThamSo(daDich);
      console.log(`\n[${nhan}]`);
      console.log('  SQL dịch:', dialect.danhSoThamSo(daDich).sql.slice(0, 220));
      const rows = await db.all(sql, { s1: '%ca phe%' });
      console.log(`  KẾT QUẢ: ${rows.length} dòng`);
      if (rows.length) console.log('  Dòng đầu:', JSON.stringify(rows[0]));
      console.log('  Tham số:', JSON.stringify(tenThamSo));
    } catch (error) {
      console.log(`\n[${nhan}] LỖI: ${error.message}`);
      if (error.position) console.log('  position:', error.position);
      if (error.hint) console.log('  hint:', error.hint);
    }
  }

  console.log('\n--- Gọi trực tiếp service ---');
  try {
    const categoryService = require('../src/services/category.service');
    const ketQua = await categoryService.listLoaiSanPham({ q: 'ca phe' });
    console.log('OK, số dòng:', ketQua.items.length, '| tổng:', ketQua.pagination.total);
  } catch (error) {
    console.log('LỖI service:', error.message);
    console.log(error.stack?.split('\n').slice(0, 6).join('\n'));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('LỖI TỔNG:', error.message);
    process.exit(1);
  });
