/**
 * Điều hướng phía giao diện dựa trên hash của URL.
 *
 * Định dạng: #/<mã-màn-hình>[/tham-so][?truy-vấn]
 * Ví dụ:     #/donhang/12        #/khaosat?tab=thong-ke
 */
'use strict';

/** Sổ đăng ký các màn hình theo mã. */
const soDangKy = new Map();

/** Hàm được gọi mỗi khi tuyến thay đổi (do app.js gán). */
let khiDoiTuyen = null;

/** Mã màn hình mặc định khi hash rỗng hoặc không hợp lệ. */
let maMacDinh = null;

/** Đăng ký một màn hình. */
export function dangKy(manHinh) {
  if (!manHinh || !manHinh.ma) throw new Error('Màn hình phải có thuộc tính "ma".');
  soDangKy.set(manHinh.ma, manHinh);
  return manHinh;
}

/** Lấy màn hình theo mã. */
export function layManHinh(ma) {
  return soDangKy.get(ma) ?? null;
}

/** Toàn bộ màn hình đã đăng ký. */
export function danhSachManHinh() {
  return Array.from(soDangKy.values());
}

/** Đặt màn hình mặc định. */
export function datMacDinh(ma) {
  maMacDinh = ma;
}

/** Đăng ký hàm xử lý khi tuyến thay đổi. */
export function datKhiDoiTuyen(fn) {
  khiDoiTuyen = fn;
}

/**
 * Phân tích hash hiện tại.
 * @returns {{ ma:string|null, duongDan:string[], query:object, hash:string }}
 */
export function docHash() {
  const hash = window.location.hash || '';
  const than = hash.startsWith('#/') ? hash.slice(2) : '';
  const [phanDuongDan, phanTruyVan] = than.split('?');
  const duongDan = phanDuongDan.split('/').filter(Boolean).map((muc) => decodeURIComponent(muc));
  const query = {};
  if (phanTruyVan) {
    for (const [ten, giaTri] of new URLSearchParams(phanTruyVan).entries()) {
      query[ten] = giaTri;
    }
  }
  return { ma: duongDan[0] ?? null, duongDan, query, hash };
}

/** Chuyển tới một màn hình. */
export function dieuHuong(ma, { duongDan = [], query = null } = {}) {
  const phan = [ma, ...duongDan].map((muc) => encodeURIComponent(String(muc))).join('/');
  let hash = `#/${phan}`;
  if (query && Object.keys(query).length > 0) {
    const thamSo = new URLSearchParams();
    for (const [ten, giaTri] of Object.entries(query)) {
      if (giaTri === null || giaTri === undefined || giaTri === '') continue;
      thamSo.set(ten, String(giaTri));
    }
    const chuoi = thamSo.toString();
    if (chuoi) hash += `?${chuoi}`;
  }
  if (window.location.hash === hash) {
    // Cùng tuyến: gọi lại bộ xử lý để làm mới dữ liệu.
    phatTuyen();
    return;
  }
  window.location.hash = hash;
}

/** Phát sự kiện tuyến hiện tại cho app.js xử lý. */
function phatTuyen() {
  if (!khiDoiTuyen) return;
  const tuyen = docHash();
  if (!tuyen.ma) {
    dieuHuong(maMacDinh ?? 'tong-quan');
    return;
  }
  khiDoiTuyen(tuyen);
}

/** Bắt đầu theo dõi thay đổi hash. */
export function batDauRouter() {
  window.addEventListener('hashchange', phatTuyen);
  if (!window.location.hash) {
    dieuHuong(maMacDinh ?? 'tong-quan');
    return;
  }
  phatTuyen();
}
