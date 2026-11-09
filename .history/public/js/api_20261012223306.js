/**
 * Lớp gọi API dùng chung.
 * - Tự đính kèm cookie phiên (credentials: same-origin) nên không cần lưu token trong JS.
 * - Bóc tách "phong bì" phản hồi { success, data } của máy chủ.
 * - Ném LoiApi kèm mã trạng thái để giao diện xử lý thống nhất.
 */
'use strict';

/** Lỗi trả về từ API (kèm mã trạng thái HTTP). */
export class LoiApi extends Error {
  constructor(status, thongDiep, chiTiet = null) {
    super(thongDiep);
    this.name = 'LoiApi';
    this.status = status;
    this.chiTiet = chiTiet;
  }

  /** Phiên đã hết hạn hoặc chưa đăng nhập. */
  get hetPhien() {
    return this.status === 401;
  }

  /** Không đủ quyền. */
  get thieuQuyen() {
    return this.status === 403;
  }
}

/** Hàm được gọi khi máy chủ trả 401 (do phiên hết hạn). */
let khiHetPhien = null;

/** Đăng ký hàm xử lý khi phiên hết hạn. */
export function datXuLyHetPhien(fn) {
  khiHetPhien = fn;
}

/** Ghép query string, bỏ qua các giá trị rỗng. */
export function xayQuery(query) {
  if (!query) return '';
  const thamSo = new URLSearchParams();
  for (const [ten, giaTri] of Object.entries(query)) {
    if (giaTri === null || giaTri === undefined) continue;
    const chuoi = String(giaTri);
    if (chuoi === '') continue;
    thamSo.set(ten, chuoi);
  }
  const chuoiThamSo = thamSo.toString();
  return chuoiThamSo ? `?${chuoiThamSo}` : '';
}

/**
 * Gọi một API.
 * @param {string} method GET | POST | PUT | PATCH | DELETE
 * @param {string} duongDan đường dẫn, ví dụ '/api/sanpham'
 * @param {{ body?: object, query?: object }} [tuyChon]
 * @returns {Promise<any>} phần `data` của phản hồi
 */
export async function goiApi(method, duongDan, tuyChon = {}) {
  const { body = null, query = null } = tuyChon;
  const headers = {};
  if (body !== null && body !== undefined) headers['Content-Type'] = 'application/json';

  let phanHoi;
  try {
    phanHoi = await fetch(`${duongDan}${xayQuery(query)}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === null || body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new LoiApi(0, 'Không kết nối được máy chủ. Kiểm tra máy chủ đã chạy chưa.');
  }

  const kieuNoiDung = phanHoi.headers.get('content-type') ?? '';
  let duLieu = null;
  if (kieuNoiDung.includes('application/json')) {
    duLieu = await phanHoi.json().catch(() => null);
  }

  if (!phanHoi.ok) {
    const thongDiep = duLieu?.message ?? `Yêu cầu thất bại (mã ${phanHoi.status}).`;
    const loi = new LoiApi(phanHoi.status, thongDiep, duLieu?.details ?? null);
    if (loi.hetPhien && khiHetPhien) khiHetPhien(loi);
    throw loi;
  }

  return duLieu && 'data' in duLieu ? duLieu.data : duLieu;
}

/** Các phương thức gọi API thường dùng. */
export const api = {
  doc: (duongDan, query) => goiApi('GET', duongDan, { query }),
  get: (duongDan, query) => goiApi('GET', duongDan, { query }),
  post: (duongDan, body) => goiApi('POST', duongDan, { body }),
  put: (duongDan, body) => goiApi('PUT', duongDan, { body }),
  patch: (duongDan, body) => goiApi('PATCH', duongDan, { body }),
  xoa: (duongDan) => goiApi('DELETE', duongDan),
};

/** Lấy thông báo lỗi hiển thị được từ một lỗi bất kỳ. */
export function thongDiepLoi(loi) {
  if (loi instanceof LoiApi) return loi.message;
  if (loi instanceof Error) return loi.message;
  return String(loi ?? 'Đã xảy ra lỗi không xác định.');
}
