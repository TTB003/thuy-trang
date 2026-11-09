/**
 * Tiện ích văn bản tiếng Việt: bỏ dấu, chuẩn hóa để tìm kiếm không phân biệt
 * dấu và chữ hoa/thường (ví dụ "ca phe" khớp "Cà phê").
 */
'use strict';

/**
 * Bỏ dấu tiếng Việt và chuyển về chữ thường.
 * @param {unknown} value
 * @returns {string|null}
 */
function unaccent(value) {
  if (value === null || value === undefined) return null;
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

/** Bọc từ khóa tìm kiếm thành mẫu LIKE, đã bỏ dấu. */
function likePattern(keyword) {
  const normalized = unaccent(keyword);
  if (!normalized) return '%%';
  return `%${normalized}%`;
}

/** Viết hoa chữ cái đầu (dùng cho nhãn hiển thị). */
function capitalize(text) {
  const value = String(text ?? '');
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Rút gọn văn bản dài. */
function truncate(text, maxLength = 80) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

module.exports = { unaccent, likePattern, capitalize, truncate };
