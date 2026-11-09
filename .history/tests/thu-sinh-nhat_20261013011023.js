'use strict';

/* Kiểm thử tầng dịch vụ cho nghiệp vụ "Ưu đãi sinh nhật":
   nâng cấp lược đồ, phiếu giảm 50% cho 1 ly, hiệu lực 3 ngày, thông báo
   tới chuông khách hàng và thao tác đánh dấu đã đọc.

   Ngày sinh của khách thử (KH #2) luôn được khôi phục và mọi phiếu/thông báo
   sinh ra trong lúc chạy đều bị xoá, kể cả khi kiểm thử thất bại. */

const db = require('../src/db');
const migrations = require('../src/db/migrations');
const voucherService = require('../src/services/voucher.service');
const thongbaoService = require('../src/services/thongbao.service');
const uuDaiService = require('../src/services/uu-dai-sinh-nhat.service');
const { toSqlDate } = require('../src/core/time');

const MA_KH = 2;
const NGAY_HIEU_LUC = 3;

let soDat = 0;
let soLoi = 0;

/** Ghi nhận kết quả một phép kiểm tra. */
function kiemTra(ten, dieuKien, chiTiet = '') {
  if (dieuKien) {
    soDat += 1;
    console.log(`  [ĐẠT] ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  } else {
    soLoi += 1;
    console.log(`  [LỖI] ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  }
}

/** Tách phần ngày "YYYY-MM-DD" của một mốc thời gian. */
function phanNgay(moc) {
  return String(moc).slice(0, 10);
}

/** Số ngày chênh lệch giữa hai mốc "YYYY-MM-DD". */
function soNgayLech(tuNgay, denNgay) {
  const tu = new Date(`${tuNgay}T00:00:00`);
  const den = new Date(`${denNgay}T00:00:00`);
  return Math.round((den - tu) / 86400000);
}

async function main() {
  await db.init();

  console.log('=== 1. NÂNG CẤP LƯỢC ĐỒ ===');
  const nangCap = await migrations.chayNangCapLuocDo();
  kiemTra('Chạy nâng cấp lược đồ', Number(nangCap?.soCauLenh) > 0, JSON.stringify(nangCap));

  const khach = await db.get('SELECT maKH, hoTen, ngaySinh FROM KHACHHANG WHERE maKH = :maKH', { maKH: MA_KH });
  const ngaySinhGoc = khach?.ngaySinh;
  const nam = new Date().getFullYear();
  const maCode = voucherService.maPhieuSinhNhat(MA_KH, nam);

  console.log('\n=== 2. QUÉT KHÁCH SINH NHẬT HÔM NAY ===');
  try {
    const homNay = toSqlDate().slice(5);
    await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
      ngaySinh: `1995-${homNay}`,
      maKH: MA_KH,
    });

    const danhSach = await uuDaiService.danhSachKhachSinhNhatHomNay();
    kiemTra(
      `Tìm thấy khách #${MA_KH} sinh nhật ${homNay}`,
      danhSach.some((k) => Number(k.maKH) === MA_KH),
      `${danhSach.length} khách`
    );

    const luotQuet = await uuDaiService.chayUuDaiSinhNhat();
    kiemTra('Lượt quét đầu tặng đúng 1 phiếu', Number(luotQuet?.soPhieuDaTang) === 1, JSON.stringify(luotQuet));

    console.log('\n=== 3. NỘI DUNG PHIẾU GIẢM GIÁ ===');
    const phieu = await voucherService.listPhieuGiamGia(MA_KH, { pageSize: 5 });
    const p = phieu.items.find((x) => x.maCode === maCode) ?? phieu.items[0] ?? null;
    kiemTra('Có phiếu giảm giá', Boolean(p), `tổng ${phieu.pagination.total}`);
    if (p) {
      kiemTra('Mã phiếu theo mẫu SN<năm>-KH<mã>', p.maCode === maCode, p.maCode);
      kiemTra('Giảm 50%', Number(p.phanTramGiam) === 50, `${p.phanTramGiam}%`);
      kiemTra('Loại phiếu là "Sinh nhật"', p.loai === 'Sinh nhật', p.loai);
      kiemTra('Trạng thái "Chưa dùng"', p.trangThai === 'Chưa dùng', p.trangThai);
      kiemTra('Nội dung nêu rõ 50% cho 1 ly', String(p.moTa ?? '').includes('50%'), p.moTa);

      const ngayTaoDate = phanNgay(p.ngayTao);
      const ngayHetHanDate = phanNgay(p.ngayHetHan);
      const lech = soNgayLech(ngayTaoDate, ngayHetHanDate);
      kiemTra(
        `Hiệu lực ${NGAY_HIEU_LUC} ngày (tính cả ngày phát hành)`,
        lech === NGAY_HIEU_LUC - 1,
        `${ngayTaoDate} → ${ngayHetHanDate} (lệch ${lech} ngày)`
      );
      kiemTra('Hết hạn cuối ngày', String(p.ngayHetHan).slice(11) === '23:59:59', String(p.ngayHetHan));

      const thongKe = await voucherService.thongKePhieuCuaKhach(MA_KH);
      kiemTra(
        'Thống kê phiếu: có phiếu chưa dùng',
        Number(thongKe.chuaDung) >= 1 && Number(thongKe.tongSo) >= 1,
        JSON.stringify(thongKe)
      );
    }

    console.log('\n=== 4. THÔNG BÁO TỚI CHUÔNG KHÁCH HÀNG ===');
    const tomTat = await thongbaoService.tomTatThongBao(MA_KH);
    kiemTra('Có 1 thông báo chưa đọc', Number(tomTat.chuaDoc) === 1, `chưa đọc = ${tomTat.chuaDoc}`);

    const tb = tomTat.moiNhat[0] ?? null;
    kiemTra('Thông báo có nội dung', Boolean(tb));
    if (tb) {
      kiemTra('Tiêu đề chúc mừng sinh nhật', String(tb.tieuDe).includes('Sinh nhật'), tb.tieuDe);
      kiemTra('Nội dung nêu 50% cho 1 ly', String(tb.noiDung).includes('50%'), '');
      kiemTra('Loại thông báo là "Ưu đãi"', tb.loai === 'Ưu đãi', tb.loai);
      kiemTra('Thông báo gắn với phiếu giảm giá', Number(tb.maPG) > 0, `maPG = ${tb.maPG}`);

      const daDocMot = await thongbaoService.danhDauDaDoc(MA_KH, tb.maTB);
      kiemTra(
        'Đánh dấu một thông báo đã đọc',
        Number(daDocMot?.daDoc) === 1 && Number(daDocMot?.chuaDoc) === 0,
        JSON.stringify(daDocMot)
      );
    }

    const daDocHet = await thongbaoService.danhDauTatCaDaDoc(MA_KH);
    kiemTra('Đánh dấu tất cả đã đọc', Number(daDocHet?.chuaDoc) === 0, JSON.stringify(daDocHet));

    console.log('\n=== 5. CHỐNG TẶNG TRÙNG ===');
    const quetLai = await uuDaiService.chayUuDaiSinhNhat();
    kiemTra('Quét lại không tặng thêm phiếu', Number(quetLai?.soPhieuDaTang) === 0, JSON.stringify(quetLai));
    const demPhieu = await db.scalar('SELECT COUNT(*) AS total FROM PHIEUGIAMGIA WHERE maKH = :maKH', { maKH: MA_KH });
    kiemTra('Mỗi khách chỉ có 1 phiếu sinh nhật', Number(demPhieu) === 1, `${demPhieu} phiếu`);
  } finally {
    console.log('\n=== 6. KHÔI PHỤC DỮ LIỆU ===');
    await db.run('DELETE FROM THONGBAO WHERE maKH = :maKH', { maKH: MA_KH });
    await db.run('DELETE FROM PHIEUGIAMGIA WHERE maKH = :maKH', { maKH: MA_KH });
    await db.run('UPDATE KHACHHANG SET ngaySinh = :ngaySinh WHERE maKH = :maKH', {
      ngaySinh: ngaySinhGoc,
      maKH: MA_KH,
    });

    const sau = await db.get('SELECT ngaySinh FROM KHACHHANG WHERE maKH = :maKH', { maKH: MA_KH });
    const conPhieu = await db.scalar('SELECT COUNT(*) AS total FROM PHIEUGIAMGIA WHERE maKH = :maKH', { maKH: MA_KH });
    const conTb = await db.scalar('SELECT COUNT(*) AS total FROM THONGBAO WHERE maKH = :maKH', { maKH: MA_KH });
    kiemTra('Ngày sinh khôi phục nguyên trạng', phanNgay(sau.ngaySinh) === phanNgay(ngaySinhGoc), String(sau.ngaySinh));
    kiemTra('Không còn phiếu/thông báo thử', Number(conPhieu) === 0 && Number(conTb) === 0, `${conPhieu} phiếu, ${conTb} thông báo`);
  }

  console.log(`\n===== KẾT QUẢ: ${soDat} đạt, ${soLoi} lỗi =====`);
  await db.closeDb();
  if (soLoi > 0) process.exitCode = 1;
}

main().catch((loi) => {
  console.error('LOI:', loi?.message ?? loi);
  process.exitCode = 1;
});
