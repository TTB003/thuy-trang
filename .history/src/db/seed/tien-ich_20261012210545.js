/**
 * Tiện ích sinh dữ liệu demo: bộ sinh số giả ngẫu nhiên TẤT ĐỊNH
 * (cùng seed cho ra cùng dữ liệu) và các hàm ngày tháng.
 */
'use strict';

const { toSqlDateTime, toSqlDate } = require('../../core/time');

/** Bộ sinh số giả ngẫu nhiên mulberry32 — tất định theo seed. */
function taoNgauNhien(seed) {
  let trangThai = seed >>> 0;
  return function next() {
    trangThai = (trangThai + 0x6d2b79f5) | 0;
    let t = Math.imul(trangThai ^ (trangThai >>> 15), 1 | trangThai);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lớp bọc tiện dụng cho bộ sinh ngẫu nhiên. */
class NgauNhien {
  constructor(seed = 20262026) {
    this.next = taoNgauNhien(seed);
  }

  /** Số thực trong [0, 1). */
  thuc() {
    return this.next();
  }

  /** Số nguyên trong [min, max] (bao gồm hai đầu). */
  soNguyen(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Chọn một phần tử ngẫu nhiên trong mảng. */
  chon(mang) {
    return mang[this.soNguyen(0, mang.length - 1)];
  }

  /** Trả về true với xác suất `tyLe` (0..1). */
  xacSuat(tyLe) {
    return this.next() < tyLe;
  }

  /** Lấy ngẫu nhiên `soLuong` phần tử khác nhau trong mảng. */
  chonNhieu(mang, soLuong) {
    const banSao = [...mang];
    const ketQua = [];
    const soCanLay = Math.min(soLuong, banSao.length);
    for (let i = 0; i < soCanLay; i += 1) {
      const viTri = this.soNguyen(0, banSao.length - 1);
      ketQua.push(banSao.splice(viTri, 1)[0]);
    }
    return ketQua;
  }
}

/** Date của `n` ngày trước hôm nay (n âm là ngày trong tương lai). */
function ngayCachHomNay(soNgay, gio = 0, phut = 0, giay = 0) {
  const date = new Date();
  date.setDate(date.getDate() + soNgay);
  date.setHours(gio, phut, giay, 0);
  return date;
}

/** Chuỗi DATETIME cách hôm nay `soNgay` ngày. */
function ngayGioCachHomNay(soNgay, gio, phut, giay) {
  return toSqlDateTime(ngayCachHomNay(soNgay, gio, phut, giay));
}

/** Chuỗi DATE cách hôm nay `soNgay` ngày. */
function ngayThangCachHomNay(soNgay) {
  return toSqlDate(ngayCachHomNay(soNgay));
}

module.exports = { NgauNhien, taoNgauNhien, ngayCachHomNay, ngayGioCachHomNay, ngayThangCachHomNay };
