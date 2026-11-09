/**
 * API xác thực và tài khoản cá nhân (CN4.5, mục 4.3.1 & 4.3.2).
 */
'use strict';

const auth = require('../core/auth');
const customerService = require('../services/customer.service');
const systemService = require('../services/system.service');
const { ok, created } = require('./helpers');

/** Đăng ký các route xác thực vào router. */
function register(router) {
  // 4.3.2 — Đăng nhập
  router.post('/api/auth/login', {}, ok((ctx) => auth.login(ctx.body.tenDangNhap, ctx.body.matKhau)));

  // Đăng xuất — hủy phiên hiện tại
  router.post('/api/auth/logout', { auth: true }, ok((ctx) => {
    auth.logout(ctx.token);
    return { thongBao: 'Đã đăng xuất khỏi hệ thống.' };
  }));

  // Thông tin người dùng đang đăng nhập (kèm danh sách quyền)
  router.get('/api/auth/me', { auth: true }, ok((ctx) => ctx.user));

  // 4.3.1 — Khách hàng tự đăng ký tài khoản
  router.post(
    '/api/auth/register',
    {},
    created((ctx) => customerService.dangKyKhachHang(ctx.body))
  );

  // Đổi mật khẩu của chính mình
  router.post(
    '/api/auth/change-password',
    { auth: true },
    ok((ctx) => systemService.doiMatKhauCaNhan(ctx.user, ctx.body.matKhauCu, ctx.body.matKhauMoi))
  );

  // Danh mục trạng thái dùng cho các form (giúp giao diện không hard-code)
  router.get('/api/danh-muc', {}, ok(() => require('../services/danh-muc')));
}

module.exports = { register };
