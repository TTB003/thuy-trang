/**
 * Quy tắc mật khẩu dùng chung cho giao diện.
 *
 * Phải khớp chính xác với `src/core/validation.js` ở máy chủ:
 *  - Ít nhất 6 ký tự.
 *  - Ít nhất 1 chữ in hoa.
 *  - Ít nhất 1 ký tự đặc biệt (không phải chữ, số hay khoảng trắng).
 */
'use strict';

/** Số ký tự tối thiểu. */
export const MAT_KHAU_TOI_THIEU = 6;
/** Số ký tự tối đa (khớp cột matKhau ở máy chủ). */
export const MAT_KHAU_TOI_DA = 100;

const CHU_IN_HOA = /[A-ZÀ-ÝĂÂĐÊÔƠƯ]/;
const KY_TU_DAC_BIET = /[^A-Za-z0-9À-ỹ\s]/;

/** Mô tả các quy tắc, dùng để dựng danh sách gợi ý trên giao diện. */
export const QUY_TAC_MAT_KHAU = [
  {
    ma: 'doDai',
    nhan: `Có ít nhất ${MAT_KHAU_TOI_THIEU} ký tự`,
    kiemTra: (mk) => mk.length >= MAT_KHAU_TOI_THIEU,
  },
  { ma: 'chuHoa', nhan: 'Có ít nhất 1 chữ in hoa', kiemTra: (mk) => CHU_IN_HOA.test(mk) },
  { ma: 'dacBiet', nhan: 'Có ít nhất 1 ký tự đặc biệt', kiemTra: (mk) => KY_TU_DAC_BIET.test(mk) },
];

/** Đánh giá mật khẩu thành từng quy tắc kèm trạng thái đạt/chưa đạt. */
export function danhGiaMatKhau(matKhau) {
  const chuoi = String(matKhau ?? '');
  return QUY_TAC_MAT_KHAU.map((quyTac) => ({
    ma: quyTac.ma,
    nhan: quyTac.nhan,
    dat: quyTac.kiemTra(chuoi),
  }));
}

/** Mật khẩu đã đạt mọi quy tắc chưa. */
export function matKhauDatChuan(matKhau) {
  return danhGiaMatKhau(matKhau).every((quyTac) => quyTac.dat);
}

/** Thông báo lỗi đầu tiên còn thiếu, hoặc null nếu mật khẩu hợp lệ. */
export function loiMatKhau(matKhau) {
  const chuaDat = danhGiaMatKhau(matKhau).filter((quyTac) => !quyTac.dat);
  if (chuaDat.length === 0) return null;
  return `Mật khẩu chưa đủ mạnh: cần ${chuaDat
    .map((quyTac) => quyTac.nhan.toLowerCase())
    .join(', ')}.`;
}

/**
 * Gắn hành vi đánh dấu quy tắc trực tiếp lên danh sách `<li data-quy-tac>`.
 * @param {HTMLInputElement} oNhap ô nhập mật khẩu
 * @param {HTMLElement} phanTuDanhSach phần tử chứa các `<li data-quy-tac>`
 * @returns {() => boolean} hàm kiểm tra mật khẩu hiện tại đã đạt chưa
 */
export function ganQuyTacMatKhau(oNhap, phanTuDanhSach) {
  const cacMuc = Array.from(phanTuDanhSach.querySelectorAll('[data-quy-tac]'));

  const capNhat = () => {
    const ketQua = danhGiaMatKhau(oNhap.value);
    for (const muc of cacMuc) {
      const quyTac = ketQua.find((item) => item.ma === muc.dataset.quyTac);
      if (!quyTac) continue;
      muc.classList.toggle('dat', quyTac.dat);
    }
    return ketQua.every((item) => item.dat);
  };

  oNhap.addEventListener('input', capNhat);
  capNhat();
  return capNhat;
}

/** Dựng danh sách `<li>` quy tắc mật khẩu (dùng khi cần tạo bằng JS). */
export function taoDanhSachQuyTac() {
  const danhSach = document.createElement('ul');
  danhSach.className = 'danh-sach-quy-tac';
  for (const quyTac of QUY_TAC_MAT_KHAU) {
    const muc = document.createElement('li');
    muc.dataset.quyTac = quyTac.ma;
    const cham = document.createElement('span');
    cham.className = 'cham-quy-tac';
    muc.append(cham, document.createTextNode(quyTac.nhan));
    danhSach.append(muc);
  }
  return danhSach;
}
