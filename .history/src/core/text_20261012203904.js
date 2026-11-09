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
