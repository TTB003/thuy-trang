/**
 * Bộ kiểm tra dữ liệu đầu vào dùng chung cho mọi API.
 * Mọi lỗi đều ném AppError 400 với thông báo tiếng Việt.
 */
'use strict';

const { badRequest } = require('./errors');

const PHONE_PATTERN = /^0\d{9,10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Lấy giá trị chuỗi đã trim; trả về '' nếu rỗng. */
function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Bắt buộc có giá trị, trả về chuỗi đã trim. */
function requiredText(value, fieldLabel, maxLength = 255) {
  const text = toText(value);
  if (!text) throw badRequest(`${fieldLabel} không được để trống.`);
  if (text.length > maxLength) {
    throw badRequest(`${fieldLabel} không được vượt quá ${maxLength} ký tự.`);
  }
  return text;
}

/** Chuỗi tùy chọn, trả về null nếu rỗng. */
function optionalText(value, maxLength = 255) {
  const text = toText(value);
  if (!text) return null;
  if (text.length > maxLength) {
    throw badRequest(`Nội dung không được vượt quá ${maxLength} ký tự.`);
  }
  return text;
}

/** Bắt buộc là số nguyên >= min. */
function requiredInt(value, fieldLabel, min = 0) {
  const parsed = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(parsed)) {
    throw badRequest(`${fieldLabel} phải là số hợp lệ.`);
  }
  if (!Number.isInteger(parsed)) throw badRequest(`${fieldLabel} phải là số nguyên.`);
  if (parsed < min) throw badRequest(`${fieldLabel} phải lớn hơn hoặc bằng ${min}.`);
  return parsed;
}

/** Số nguyên tùy chọn với giá trị mặc định. */
function optionalInt(value, defaultValue, min = 0) {
  if (value === '' || value === null || value === undefined) return defaultValue;
  return requiredInt(value, 'Giá trị', min);
}

/** Bắt buộc là số (thực) >= min. */
function requiredNumber(value, fieldLabel, min = 0) {
  const parsed = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(parsed)) {
    throw badRequest(`${fieldLabel} phải là số hợp lệ.`);
  }
  if (parsed < min) throw badRequest(`${fieldLabel} phải lớn hơn hoặc bằng ${min}.`);
  return Math.round(parsed * 100) / 100;
}

/** Kiểm tra số điện thoại Việt Nam. */
function phone(value, fieldLabel = 'Số điện thoại') {
  const text = requiredText(value, fieldLabel, 15);
  if (!PHONE_PATTERN.test(text)) {
    throw badRequest(`${fieldLabel} không đúng định dạng (ví dụ: 0901234567).`);
  }
  return text;
}

/** Kiểm tra email. */
function email(value, fieldLabel = 'Email') {
  const text = requiredText(value, fieldLabel, 100);
  if (!EMAIL_PATTERN.test(text)) {
    throw badRequest(`${fieldLabel} không đúng định dạng.`);
  }
  return text.toLowerCase();
}

/** Email tùy chọn. */
function optionalEmail(value) {
  const text = toText(value);
  if (!text) return null;
  return email(text);
}

/** Kiểm tra ngày dạng YYYY-MM-DD. */
function dateOnly(value, fieldLabel = 'Ngày', { allowNull = false } = {}) {
  const text = toText(value);
  if (!text) {
    if (allowNull) return null;
    throw badRequest(`${fieldLabel} không được để trống.`);
  }
  if (!DATE_PATTERN.test(text)) {
    throw badRequest(`${fieldLabel} phải có định dạng YYYY-MM-DD.`);
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`${fieldLabel} không hợp lệ.`);
  return text;
}

/** Bắt buộc giá trị nằm trong danh sách cho phép. */
function oneOf(value, allowed, fieldLabel) {
  const text = requiredText(value, fieldLabel, 60);
  if (!allowed.includes(text)) {
    throw badRequest(`${fieldLabel} không hợp lệ. Chỉ chấp nhận: ${allowed.join(', ')}.`);
  }
  return text;
}

/**
 * Mật khẩu mạnh cho tài khoản khách hàng:
 * tối thiểu 6 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt.
 */
const MAT_KHAU_TOI_THIEU = 6;
const MAT_KHAU_TOI_DA = 100;
const CHU_IN_HOA = /[A-ZÀ-ÝĂÂĐÊÔƠƯ]/;
const KY_TU_DAC_BIET = /[^A-Za-z0-9À-ỹ\s]/;

/** Mô tả các quy tắc mật khẩu để giao diện hiển thị giống máy chủ. */
const QUY_TAC_MAT_KHAU = [
  { ma: 'doDai', moTa: `Có ít nhất ${MAT_KHAU_TOI_THIEU} ký tự` },
  { ma: 'chuHoa', moTa: 'Có ít nhất 1 chữ in hoa' },
  { ma: 'dacBiet', moTa: 'Có ít nhất 1 ký tự đặc biệt' },
];

/** Kiểm tra từng quy tắc, trả về mảng các quy tắc còn thiếu. */
function kiemTraQuyTacMatKhau(matKhau) {
  const chuoi = String(matKhau ?? '');
  const thieu = [];
  if (chuoi.length < MAT_KHAU_TOI_THIEU) thieu.push('doDai');
  if (!CHU_IN_HOA.test(chuoi)) thieu.push('chuHoa');
  if (!KY_TU_DAC_BIET.test(chuoi)) thieu.push('dacBiet');
  return thieu;
}

/** Bắt buộc mật khẩu đạt đủ các quy tắc an toàn. */
function strongPassword(value, fieldLabel = 'Mật khẩu') {
  const text = requiredText(value, fieldLabel, MAT_KHAU_TOI_DA);
  const thieu = kiemTraQuyTacMatKhau(text);
  if (thieu.length > 0) {
    const chiTiet = QUY_TAC_MAT_KHAU.filter((quyTac) => thieu.includes(quyTac.ma))
      .map((quyTac) => quyTac.moTa.toLowerCase())
      .join(', ');
    throw badRequest(`${fieldLabel} chưa đủ mạnh: cần ${chiTiet}.`);
  }
  return text;
}

/** Danh sách id dạng mảng số nguyên, không rỗng. */
function idList(value, fieldLabel = 'Danh sách') {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest(`${fieldLabel} không được để trống.`);
  }
  const unique = [...new Set(value.map((item) => requiredInt(item, fieldLabel, 1)))];
  return unique;
}

/** Trả về mảng nếu là mảng, ngược lại trả về [] */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  toText,
  requiredText,
  optionalText,
  requiredInt,
  optionalInt,
  requiredNumber,
  phone,
  email,
  optionalEmail,
  dateOnly,
  oneOf,
  idList,
  asArray,
  strongPassword,
  kiemTraQuyTacMatKhau,
  QUY_TAC_MAT_KHAU,
  MAT_KHAU_TOI_THIEU,
  PHONE_PATTERN,
  EMAIL_PATTERN,
};
