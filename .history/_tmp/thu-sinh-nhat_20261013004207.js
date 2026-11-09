'use strict';

/* Kiểm thử trực tiếp tầng dịch vụ: nâng cấp lược đồ, phiếu sinh nhật,
   thông báo và đánh dấu đã đọc. Dữ liệu thử được dọn sạch sau khi xong. */

const db = require('../src/db');
const migrations = require('../src/db/migrations');
const voucherService = require('../src/services/voucher.service');
const thongbaoService = require('../src/services/thongbao.service');
const uuDaiService = require('../src/services/uu-dai-sinh-nhat.service');
const { toSqlDate } = require('../src/core/time');

const MA_KH = 2;

async function main() {
  await db.init();
  console.log(`He CSDL: ${db.getClient()}`);

  const nangCap = await migrations.chayNangCapLuocDo();
  console.log(`Nang cap luoc do: ${JSON.stringify(nangCap)}`);

  const bang = await db.danhSachBang();
  const coBang = bang.filter((ten) => ['PHIEUGIAMGIA', 'THONGBAO'].includes(String(ten).toUpperCase()));
  console.log(`Bang moi hien co: ${JSON.stringify(coBang)}`);

  const khach = await db.get('SELECT maKH, hoTen, ngaySinh FROM KHACHHANG WHERE maKH = :maKH', {
    maKH: MA_KH,
  });
  console.log(`Khach thu: #${khach.maKH} ${khach.hoTen} - ngay sinh goc: ${khach.ngaySinh}`);
  const ngaySinhGoc = khach.ngaySinh;

  const homNay = toSqlDate().slice(5);
  await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
    ngaySinh: `1995-${homNay}`,
    maKH: MA_KH,
  });

  const danhSach = await uuDaiService.danhSachKhachSinhNhatHomNay();
  console.log(`\nKhach co sinh nhat hom nay (${homNay}): ${JSON.stringify(danhSach.map((k) => k.hoTen))}`);

  const ketQuaQuet = await uuDaiService.chayUuDaiSinhNhat();
  console.log(`Luot quet: ${JSON.stringify(ketQuaQuet)}`);

  const phieu = await voucherService.listPhieuGiamGia(MA_KH, { pageSize: 5 });
  console.log(`\nPhieu giam gia cua khach #${MA_KH}: ${phieu.pagination.total}`);
  console.log(`  ${JSON.stringify(phieu.items[0] ?? null)}`);

  const thongKe = await voucherService.thongKePhieuCuaKhach(MA_KH);
  console.log(`  Thong ke: ${JSON.stringify(thongKe)}`);

  const tomTat = await thongbaoService.tomTatThongBao(MA_KH);
  console.log(`\nChuong thong bao: chua doc = ${tomTat.chuaDoc}`);
  console.log(`  ${JSON.stringify(tomTat.moiNhat[0] ?? null)}`);

  const danhSachTb = await thongbaoService.listThongBao(MA_KH, { pageSize: 3 });
  console.log(`  Tong thong bao: ${danhSachTb.pagination.total}`);

  if (tomTat.moiNhat[0]) {
    const daDoc = await thongbaoService.danhDauDaDoc(MA_KH, tomTat.moiNhat[0].maTB);
    console.log(`  Danh dau da doc: ${JSON.stringify(daDoc)}`);
  }

  const tatCa = await thongbaoService.danhDauTatCaDaDoc(MA_KH);
  console.log(`  Danh dau tat ca da doc: ${JSON.stringify(tatCa)}`);

  const quetLai = await uuDaiService.chayUuDaiSinhNhat();
  console.log(`\nQuet lan 2 (phai bang 0): soPhieuDaTang = ${quetLai.soPhieuDaTang}`);

  /* ---------------------- DON DEP DU LIEU THU ---------------------- */
  const nam = new Date().getFullYear();
  const maCode = voucherService.maPhieuSinhNhat(MA_KH, nam);
  await db.run(
    'DELETE FROM THONGBAO WHERE maKH = :maKH AND maPG IN (SELECT maPG FROM PHIEUGIAMGIA WHERE maCode = :maCode)',
    { maKH: MA_KH, maCode }
  );
  await db.run('DELETE FROM PHIEUGIAMGIA WHERE maKH = :maKH AND maCode = :maCode', {
    maKH: MA_KH,
    maCode,
  });
  await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
    ngaySinh: ngaySinhGoc,
    maKH: MA_KH,
  });

  const conLai = await db.scalar('SELECT COUNT(*) FROM PHIEUGIAMGIA WHERE maKH = :maKH', {
    maKH: MA_KH,
  });
  const tbConLai = await db.scalar('SELECT COUNT(*) FROM THONGBAO WHERE maKH = :maKH', {
    maKH: MA_KH,
  });
  const khachSau = await db.get('SELECT ngaySinh FROM KHACHHANG WHERE maKH = :maKH', {
    maKH: MA_KH,
  });
  console.log(
    `\nDon dep: phieu con ${conLai}, thong bao con ${tbConLai}, ngay sinh khoi phuc = ${khachSau.ngaySinh}`
  );

  await db.closeDb();
}

main().catch((loi) => {
  console.error('LOI:', loi);
  process.exitCode = 1;
});
