/**
 * ƯU ĐÃI SINH NHẬT — tự động tặng phiếu giảm giá 50% cho 1 ly vào đúng ngày
 * sinh nhật của khách hàng, kèm một thông báo trong chuông của khách.
 *
 * Cách chạy:
 *   - Máy chủ gọi `chayUuDaiSinhNhat()` khi khởi động và định kỳ mỗi 6 giờ.
 *   - Khi khách mở cổng khách hàng, `chayUuDaiSinhNhatChoKhach(maKH)` được gọi
 *     để bảo đảm phiếu có ngay cả khi máy chủ chưa chạy tới lượt quét.
 *
 * Mỗi khách chỉ nhận một phiếu sinh nhật trong một năm (mã phiếu SN<nam>-KH<maKH>).
 */
'use strict';

const db = require('../db');
const voucherService = require('./voucher.service');
const thongbaoService = require('./thongbao.service');
const { toSqlDate } = require('../core/time');

/** Ngày–tháng hôm nay dạng 'MM-DD'. */
function ngayThangHomNay() {
  return toSqlDate().slice(5);
}

/** Danh sách khách hàng có sinh nhật đúng hôm nay. */
async function danhSachKhachSinhNhatHomNay() {
  return db.all(
    `SELECT kh.maKH, kh.hoTen, kh.sdt, kh.ngaySinh
       FROM KHACHHANG kh
      WHERE kh.ngaySinh IS NOT NULL
        AND kh.trangThai = N'Hoạt động'
        AND ${db.bieuThucNgayThang('kh.ngaySinh')} = :homNay
      ORDER BY kh.hoTen ASC`,
    { homNay: ngayThangHomNay() }
  );
}

/** Định dạng ngày hiển thị trong lời chúc: 'DD/MM/YYYY'. */
function dinhDangNgay(value) {
  if (!value) return '';
  const chuoi = String(value).slice(0, 10);
  const [nam, thang, ngay] = chuoi.split('-');
  return nam && thang && ngay ? `${ngay}/${thang}/${nam}` : chuoi;
}

/**
 * Tặng ưu đãi sinh nhật cho một khách hàng nếu hôm nay đúng sinh nhật.
 * @returns {{ daTang: boolean, lyDo?: string, phieu?: object }}
 */
async function chayUuDaiSinhNhatChoKhach(maKH) {
  const khach = await db.get(
    `SELECT kh.maKH, kh.hoTen, kh.ngaySinh, kh.trangThai,
            ${db.bieuThucNgayThang('kh.ngaySinh')} AS ngayThang
       FROM KHACHHANG kh
      WHERE kh.maKH = :maKH`,
    { maKH }
  );
  if (!khach || !khach.ngaySinh) return { daTang: false, lyDo: 'chua-co-ngay-sinh' };
  if (String(khach.ngayThang) !== ngayThangHomNay()) {
    return { daTang: false, lyDo: 'khong-phai-sinh-nhat' };
  }

  const nam = new Date().getFullYear();
  const daCo = await voucherService.daCoPhieuSinhNhatNamNay(maKH, nam);
  if (daCo) return { daTang: false, lyDo: 'da-tang-nam-nay' };

  const phieu = await voucherService.taoPhieuSinhNhat(maKH, nam);
  if (!phieu) return { daTang: false, lyDo: 'da-tang-nam-nay' };

  await thongbaoService.taoThongBao({
    maKH,
    tieuDe: `Sinh nhật vui vẻ, ${khach.hoTen}!`,
    noiDung:
      `Cửa hàng gửi tặng bạn phiếu giảm ${phieu.phanTramGiam}% cho 1 ly. ` +
      `Phiếu có hiệu lực đến hết ${dinhDangNgay(phieu.ngayHetHan)}.`,
    loai: 'Ưu đãi',
    maPG: phieu.maPG,
  });

  return { daTang: true, phieu };
}

/**
 * Quét toàn bộ khách hàng có sinh nhật hôm nay và tặng ưu đãi.
 * An toàn khi gọi lặp lại: khách đã nhận phiếu trong năm sẽ bị bỏ qua.
 */
async function chayUuDaiSinhNhat() {
  const danhSach = await danhSachKhachSinhNhatHomNay();
  const daTang = [];
  for (const khach of danhSach) {
    try {
      const ketQua = await chayUuDaiSinhNhatChoKhach(khach.maKH);
      if (ketQua.daTang) {
        daTang.push({ maKH: khach.maKH, hoTen: khach.hoTen, maPG: ketQua.phieu.maPG });
      }
    } catch (loi) {
      // Một khách lỗi không được làm dừng cả lượt quét.
      console.error(`[uu-dai-sinh-nhat] Lỗi khi tặng ưu đãi cho khách #${khach.maKH}:`, loi.message);
    }
  }
  return {
    ngay: ngayThangHomNay(),
    soKhachSinhNhat: danhSach.length,
    soPhieuDaTang: daTang.length,
    chiTiet: daTang,
  };
}

module.exports = {
  ngayThangHomNay,
  danhSachKhachSinhNhatHomNay,
  chayUuDaiSinhNhatChoKhach,
  chayUuDaiSinhNhat,
};
