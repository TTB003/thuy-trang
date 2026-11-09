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
  PHONE_PATTERN,
  EMAIL_PATTERN,
};
