/**
 * Bảo mật: băm mật khẩu bằng scrypt (có salt) và sinh token phiên đăng nhập.
 */
'use strict';

const crypto = require('node:crypto');

const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;

/** Băm mật khẩu → chuỗi 'salt:hash' để lưu vào CSDL. */
function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/** Đối chiếu mật khẩu người dùng nhập với giá trị đã băm trong CSDL. */
function verifyPassword(plainPassword, storedValue) {
  if (!storedValue || typeof storedValue !== 'string') return false;
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

/** Sinh token phiên đăng nhập ngẫu nhiên. */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateToken };
