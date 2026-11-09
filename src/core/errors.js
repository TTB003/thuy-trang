/**
 * Lỗi nghiệp vụ có mã HTTP — dùng để trả về thông báo rõ ràng cho client.
 */
'use strict';

class AppError extends Error {
  /**
   * @param {number} status Mã HTTP
   * @param {string} message Thông báo tiếng Việt hiển thị cho người dùng
   * @param {object} [details] Thông tin bổ sung
   */
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, message, details);
const unauthorized = (message = 'Bạn cần đăng nhập để thực hiện thao tác này.') =>
  new AppError(401, message);
const forbidden = (message = 'Bạn không có quyền thực hiện chức năng này.') =>
  new AppError(403, message);
const notFound = (message = 'Không tìm thấy dữ liệu yêu cầu.') => new AppError(404, message);
const conflict = (message, details) => new AppError(409, message, details);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };
