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

const MOBILE_API_URL = String(window.COFFEE_CRM_API_URL ?? '').replace(/\/$/, '');
const MOBILE_TOKEN_KEY = 'coffee_crm_mobile_token';

function datTokenDiDong(token) {
  if (!MOBILE_API_URL) return;
  if (token) localStorage.setItem(MOBILE_TOKEN_KEY, token);
  else localStorage.removeItem(MOBILE_TOKEN_KEY);
}

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
  const mobileToken = MOBILE_API_URL ? localStorage.getItem(MOBILE_TOKEN_KEY) : null;
  if (mobileToken) headers.Authorization = `Bearer ${mobileToken}`;
  if (MOBILE_API_URL) headers['ngrok-skip-browser-warning'] = 'true';

  let phanHoi;
  const boDem = new AbortController();
  const henGio = window.setTimeout(() => boDem.abort(), 30000);
  try {
    phanHoi = await fetch(`${MOBILE_API_URL}${duongDan}${xayQuery(query)}`, {
      method,
      headers,
      credentials: MOBILE_API_URL ? 'omit' : 'same-origin',
      signal: boDem.signal,
      body: body === null || body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const diaChiMayChu = MOBILE_API_URL ? ` (${MOBILE_API_URL})` : '';
    const lyDo = boDem.signal.aborted ? 'Máy chủ phản hồi quá lâu' : 'Không kết nối được máy chủ';
    throw new LoiApi(0, `${lyDo}${diaChiMayChu}. Kiểm tra máy chủ, URL tunnel và kết nối mạng.`);
  } finally {
    window.clearTimeout(henGio);
  }

  const kieuNoiDung = phanHoi.headers.get('content-type') ?? '';
  let duLieu = null;
  if (kieuNoiDung.includes('application/json')) {
    duLieu = await phanHoi.json().catch(() => null);
  }

  if (MOBILE_API_URL && !kieuNoiDung.includes('application/json')) {
    throw new LoiApi(502, 'Máy chủ không trả dữ liệu JSON. Có thể tunnel đang hiện trang cảnh báo hoặc URL chưa trỏ tới Coffee CRM.');
  }

  if (!phanHoi.ok) {
    const thongDiep = duLieu?.message ?? `Yêu cầu thất bại (mã ${phanHoi.status}).`;
    const loi = new LoiApi(phanHoi.status, thongDiep, duLieu?.details ?? null);
    // 401 từ đăng nhập hoặc kiểm tra phiên ban đầu không phải phiên đã hết hạn.
    if (
      loi.hetPhien &&
      khiHetPhien &&
      duongDan !== '/api/auth/login' &&
      duongDan !== '/api/auth/me'
    ) {
      khiHetPhien(loi);
    }
    throw loi;
  }

  if (MOBILE_API_URL && ['/api/auth/login', '/api/admin/login'].includes(duongDan)) {
    if (!duLieu?.data?.token || !duLieu?.data?.user) {
      throw new LoiApi(502, 'Máy chủ không trả phiên đăng nhập hợp lệ. Mật khẩu vẫn được giữ lại; hãy kiểm tra URL tunnel/server.');
    }
    datTokenDiDong(duLieu?.data?.token);
  }
  if (MOBILE_API_URL && duongDan === '/api/auth/logout') datTokenDiDong(null);

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

export const dangChayTrenMobile = Boolean(MOBILE_API_URL);

/** Lấy thông báo lỗi hiển thị được từ một lỗi bất kỳ. */
export function thongDiepLoi(loi) {
  if (loi instanceof LoiApi) return loi.message;
  if (loi instanceof Error) return loi.message;
  return String(loi ?? 'Đã xảy ra lỗi không xác định.');
}
