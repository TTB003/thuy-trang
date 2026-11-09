'use strict';

/* Dọn dẹp dữ liệu của lần kiểm thử trước:
   - trả ngày sinh khách #2 về giá trị gốc 1991-08-23
   - xóa phiếu giảm giá và thông báo sinh ra trong lúc thử */

const db = require('../src/db');

async function main() {
  await db.init();

  const truoc = await db.get('SELECT maKH, hoTen, ngaySinh FROM KHACHHANG WHERE maKH = 2');
  console.log(`Trước: ${JSON.stringify(truoc)}`);

  await db.run("UPDATE KHACHHANG SET ngaySinh = '1991-08-23' WHERE maKH = 2");
  const xoaTb = await db.run('DELETE FROM THONGBAO WHERE maKH = 2');
  const xoaPg = await db.run('DELETE FROM PHIEUGIAMGIA WHERE maKH = 2');

  const sau = await db.get('SELECT maKH, hoTen, ngaySinh FROM KHACHHANG WHERE maKH = 2');
  const conTb = await db.scalar('SELECT COUNT(*) AS total FROM THONGBAO WHERE maKH = 2');
  const conPg = await db.scalar('SELECT COUNT(*) AS total FROM PHIEUGIAMGIA WHERE maKH = 2');

  console.log(`Sau:   ${JSON.stringify(sau)}`);
  console.log(`Đã xóa: thông báo ${xoaTb?.changes ?? 0}, phiếu ${xoaPg?.changes ?? 0}`);
  console.log(`Còn lại: thông báo ${conTb}, phiếu ${conPg}`);

  await db.closeDb();
}

main().catch((loi) => {
  console.error('LOI:', loi);
  process.exitCode = 1;
});
