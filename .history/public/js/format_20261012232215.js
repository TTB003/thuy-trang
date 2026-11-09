/**
 * Định dạng hiển thị: tiền đồng, số, ngày giờ, phần trăm và xuất tệp CSV.
 * Mọi hàm đều thuần túy (không phụ thuộc DOM) để dễ kiểm thử.
 */
'use strict';

/** Số nguyên có dấu phân cách nghìn theo quy ước Việt Nam (1.250.000). */
export function so(giaTri) {
  const n = Number(giaTri);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('vi-VN');
}

/** Số thập phân với số chữ số sau dấu phẩy cho trước. */
export function soThapPhan(giaTri, chuSo = 1) {
  const n = Number(giaTri);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: chuSo,
    maximumFractionDigits: chuSo,
  });
}

/** Tiền đồng: 1250000 -> "1.250.000 ₫". */
export function tien(giaTri, { donVi = true } = {}) {
  const n = Number(giaTri);
  if (!Number.isFinite(n)) return donVi ? '0 ₫' : '0';
  return `${Math.round(n).toLocaleString('vi-VN')}${donVi ? ' ₫' : ''}`;
}

/** Rút gọn tiền cho thẻ số liệu: 1250000 -> "1,25 triệu". */
export function tienRutGon(giaTri) {
  const n = Number(giaTri) || 0;
  const tuyetDoi = Math.abs(n);
  if (tuyetDoi >= 1_000_000_000) return `${soThapPhan(n / 1_000_000_000, 2)} tỷ`;
  if (tuyetDoi >= 1_000_000) return `${soThapPhan(n / 1_000_000, 2)} triệu`;
  if (tuyetDoi >= 1_000) return `${soThapPhan(n / 1_000, 1)} nghìn`;
  return so(n);
}

/** Phần trăm: 12.5 -> "12,5%". */
export function phanTram(giaTri, chuSo = 1) {
  const n = Number(giaTri);
  if (!Number.isFinite(n)) return '0%';
  return `${soThapPhan(n, chuSo)}%`;
}

/** Tách giá trị ngày thành đối tượng Date (nhận cả chuỗi PostgreSQL). */
function denDoiTuongNgay(giaTri) {
  if (!giaTri && giaTri !== 0) return null;
  if (giaTri instanceof Date) return Number.isNaN(giaTri.getTime()) ? null : giaTri;
  const chuoi = String(giaTri).trim();
  if (!chuoi) return null;
  // PostgreSQL trả về 'YYYY-MM-DD HH:MM:SS'; đổi sang dạng ISO để hiểu là giờ cục bộ.
  const chuanHoa = chuoi.includes('T') ? chuoi : chuoi.replace(' ', 'T');
  const ngayDoi = new Date(chuanHoa);
  return Number.isNaN(ngayDoi.getTime()) ? null : ngayDoi;
}

/** Dung lượng tệp: 2048 -> "2,0 KB", 5242880 -> "5,0 MB". */
export function soDungLuong(soByte) {
  const n = Number(soByte);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${soThapPhan(n / 1024, 1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${soThapPhan(n / (1024 * 1024), 1)} MB`;
  return `${soThapPhan(n / (1024 * 1024 * 1024), 2)} GB`;
}

/** Ngày dạng 12/10/2026. */
export function ngay(giaTri) {
  const ngayDoi = denDoiTuongNgay(giaTri);
  if (!ngayDoi) return '—';
  return ngayDoi.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Ngày giờ dạng 12/10/2026 22:15. */
export function ngayGio(giaTri) {
  const ngayDoi = denDoiTuongNgay(giaTri);
  if (!ngayDoi) return '—';
  const gio = ngayDoi.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${ngay(giaTri)} ${gio}`;
}

/** Khoảng thời gian tương đối: "3 giờ trước", "hôm qua". */
export function thoiGianTuongDoi(giaTri) {
  const ngayDoi = denDoiTuongNgay(giaTri);
  if (!ngayDoi) return '—';
  const giay = Math.floor((Date.now() - ngayDoi.getTime()) / 1000);

  if (giay < 0) return ngayGio(giaTri);
  if (giay < 60) return 'vừa xong';
  if (giay < 3600) return `${Math.floor(giay / 60)} phút trước`;
  if (giay < 86400) return `${Math.floor(giay / 3600)} giờ trước`;
  if (giay < 172800) return 'hôm qua';
  if (giay < 2592000) return `${Math.floor(giay / 86400)} ngày trước`;
  if (giay < 31536000) return `${Math.floor(giay / 2592000)} tháng trước`;
  return `${Math.floor(giay / 31536000)} năm trước`;
}

/** Ngày dạng cho ô <input type="date"> (YYYY-MM-DD). */
export function ngayChoInput(giaTri) {
  const ngayDoi = denDoiTuongNgay(giaTri);
  if (!ngayDoi) return '';
  const thang = String(ngayDoi.getMonth() + 1).padStart(2, '0');
  const ngayTrongThang = String(ngayDoi.getDate()).padStart(2, '0');
  return `${ngayDoi.getFullYear()}-${thang}-${ngayTrongThang}`;
}

/** Chữ cái đầu của họ tên để làm ảnh đại diện: "Nguyễn Văn An" -> "NA". */
export function chuCaiDau(hoTen) {
  const tu = String(hoTen ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tu.length === 0) return '?';
  const dau = tu[0].charAt(0);
  const cuoi = tu.length > 1 ? tu[tu.length - 1].charAt(0) : '';
  return (dau + cuoi).toUpperCase();
}

/** Cắt ngắn chuỗi và thêm dấu ba chấm. */
export function vietTat(chuoi, doDaiToiDa = 48) {
  const giaTri = String(chuoi ?? '');
  if (giaTri.length <= doDaiToiDa) return giaTri;
  return `${giaTri.slice(0, doDaiToiDa - 1).trimEnd()}…`;
}

/** Số điện thoại dạng 0912 000 001. */
export function soDienThoai(sdt) {
  const chuSo = String(sdt ?? '').replace(/\D/g, '');
  if (chuSo.length !== 10) return String(sdt ?? '—');
  return `${chuSo.slice(0, 4)} ${chuSo.slice(4, 7)} ${chuSo.slice(7)}`;
}

/** Giá trị hiển thị an toàn: null/undefined/rỗng -> '—'. */
export function hienThi(giaTri) {
  if (giaTri === null || giaTri === undefined || giaTri === '') return '—';
  return String(giaTri);
}

/** Mảng đối tượng -> nội dung CSV (có BOM để Excel mở đúng tiếng Việt). */
export function taoCsv(danhSach, cot) {
  const thoat = (giaTri) => {
    const chuoi = giaTri === null || giaTri === undefined ? '' : String(giaTri);
    return `"${chuoi.replace(/"/g, '""')}"`;
  };
  const dong = [cot.map((muc) => thoat(muc.tieuDe)).join(',')];
  for (const ban of danhSach) {
    dong.push(cot.map((muc) => thoat(muc.lay(ban))).join(','));
  }
  return `\ufeff${dong.join('\r\n')}`;
}

/** Tải một tệp văn bản xuống máy người dùng. */
export function taiTep(tenTep, noiDung, kieuMime = 'text/csv;charset=utf-8') {
  const blob = new Blob([noiDung], { type: kieuMime });
  const duongDan = URL.createObjectURL(blob);
  const the = document.createElement('a');
  the.href = duongDan;
  the.download = tenTep;
  document.body.appendChild(the);
  the.click();
  document.body.removeChild(the);
  URL.revokeObjectURL(duongDan);
}

/** Tên tệp kèm ngày giờ để các lần xuất không ghi đè nhau. */
export function tenTepCoNgay(tienTo, duoiTep = 'csv') {
  const now = new Date();
  const thang = String(now.getMonth() + 1).padStart(2, '0');
  const ngayTrongThang = String(now.getDate()).padStart(2, '0');
  const gio = String(now.getHours()).padStart(2, '0');
  const phut = String(now.getMinutes()).padStart(2, '0');
  return `${tienTo}_${now.getFullYear()}${thang}${ngayTrongThang}_${gio}${phut}.${duoiTep}`;
}

/** Lớp nhãn màu tương ứng với trạng thái nghiệp vụ. */
export function mauTheoTrangThai(trangThai) {
  const bang = {
    'Hoạt động': 'nhan-xanh',
    'Đang làm việc': 'nhan-xanh',
    'Đang bán': 'nhan-xanh',
    'Hoàn thành': 'nhan-xanh',
    'Đã xử lý': 'nhan-xanh',
    'Đang mở': 'nhan-xanh',
    'Đang diễn ra': 'nhan-xanh',
    'Đang hợp tác': 'nhan-xanh',
    'Đang giao': 'nhan-xam',
    'Đã xác nhận': 'nhan-xam',
    'Chờ xử lý': 'nhan-vang',
    'Chờ duyệt': 'nhan-vang',
    'Sắp hết hàng': 'nhan-vang',
    'Sắp diễn ra': 'nhan-cam',
    'Bị khóa': 'nhan-do',
    'Đã hủy': 'nhan-do',
    'Hết hàng': 'nhan-do',
    'Đã hết hạn': 'nhan-do',
    'Ngừng bán': 'nhan-trung-tinh',
    'Đã vô hiệu hóa': 'nhan-trung-tinh',
    'Đã đóng': 'nhan-trung-tinh',
    'Ngừng hợp tác': 'nhan-trung-tinh',
    'Đã kết thúc': 'nhan-trung-tinh',
  };
  return bang[trangThai] ?? 'nhan-trung-tinh';
}
