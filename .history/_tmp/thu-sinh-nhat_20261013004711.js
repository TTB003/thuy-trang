'use strict';

/* Kiểm thử tầng dịch vụ: nâng cấp lược đồ, phiếu sinh nhật (3 ngày),
   thông báo và đánh dấu đã đọc. Ngày sinh của khách thử luôn được khôi phục. */

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

  console.log(`Nang cap luoc do: ${JSON.stringify(await migrations.chayNangCapLuocDo())}`);

  const khach = await db.get('SELECT maKH, hoTen, ngaySinh FROM KHACHHANG WHERE maKH = :maKH', {
    maKH: MA_KH,
  });
  const ngaySinhGoc = khach.ngaySinh;
  console.log(`Khach thu: #${khach.maKH} ${khach.hoTen} - ngay sinh goc: ${ngaySinhGoc}`);

  const nam = new Date().getFullYear();
  const maCode = voucherService.maPhieuSinhNhat(MA_KH, nam);

  try {
    const homNay = toSqlDate().slice(5);
    await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
      ngaySinh: `1995-${homNay}`,
      maKH: MA_KH,
    });

    const danhSach = await uuDaiService.danhSachKhachSinhNhatHomNay();
    console.log(
      `\nKhach sinh nhat hom nay (${homNay}): ${JSON.stringify(danhSach.map((k) => k.hoTen))}`
    );

    console.log(`Luot quet: ${JSON.stringify(await uuDaiService.chayUuDaiSinhNhat())}`);

    const phieu = await voucherService.listPhieuGiamGia(MA_KH, { pageSize: 5 });
    const p = phieu.items[0] ?? null;
    console.log(`\nPhieu giam gia: ${phieu.pagination.total}`);
    if (p) {
      console.log(`  maCode=${p.maCode} phanTram=${p.phanTramGiam}% loai=${p.loai} trangThai=${p.trangThai}`);
      console.log(`  ngayTao=${p.ngayTao} -> ngayHetHan=${p.ngayHetHan}`);
      const soNgay = Math.round(
        (new Date(p.ngayHetHan.replace(' ', 'T')) - new Date(p.ngayTao.replace(' ', 'T'))) / 86400000
      );
      console.log(`  => Hieu luc: ${soNgay} ngay`);
    }
    console.log(`  Thong ke: ${JSON.stringify(await voucherService.thongKePhieuCuaKhach(MA_KH))}`);

    const tomTat = await thongbaoService.tomTatThongBao(MA_KH);
    console.log(`\nChuong thong bao: chua doc = ${tomTat.chuaDoc}`);
    const tb = tomTat.moiNhat[0] ?? null;
    if (tb) {
      console.log(`  tieuDe: ${tb.tieuDe}`);
      console.log(`  noiDung: ${tb.noiDung}`);
      console.log(`  maPG=${tb.maPG} loai=${tb.loai} daDoc=${tb.daDoc}`);
    }

    if (tb) {
      console.log(`\nDanh dau mot thong bao da doc: ${JSON.stringify(await thongbaoService.danhDauDaDoc(MA_KH, tb.maTB))}`);
    }
    console.log(`Danh dau tat ca da doc: ${JSON.stringify(await thongbaoService.danhDauTatCaDaDoc(MA_KH))}`);
    console.log(`Quet lai (phai = 0): ${(await uuDaiService.chayUuDaiSinhNhat()).soPhieuDaTang}`);
  } finally {
    await db.run('DELETE FROM THONGBAO WHERE maKH = :maKH', { maKH: MA_KH });
    await db.run('DELETE FROM PHIEUGIAMGIA WHERE maKH = :maKH AND maCode = :maCode', {
      maKH: MA_KH,
      maCode,
    });
    await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
      ngaySinh: ngaySinhGoc,
      maKH: MA_KH,
    });
    const sau = await db.get('SELECT ngaySinh FROM KHACHHANG WHERE maKH = :maKH', { maKH: MA_KH });
    const conPg = await db.scalar('SELECT COUNT(*) AS total FROM PHIEUGIAMGIA WHERE maKH = :maKH', {
      maKH: MA_KH,
    });
    const conTb = await db.scalar('SELECT COUNT(*) AS total FROM THONGBAO WHERE maKH = :maKH', {
      maKH: MA_KH,
    });
    console.log(
      `\nDon dep xong: ngay sinh = ${sau.ngaySinh}, phieu con ${conPg}, thong bao con ${conTb}`
    );
  }

  await db.closeDb();
}

main().catch((loi) => {
  console.error('LOI:', loi);
  process.exitCode = 1;
});
