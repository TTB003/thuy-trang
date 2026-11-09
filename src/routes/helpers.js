/**
 * Tiện ích dùng chung cho các route: bọc handler trả về dữ liệu JSON,
 * chuyển tham số đường dẫn sang số nguyên.
 */
'use strict';

const { badRequest } = require('../core/errors');

/** Bọc handler trả về dữ liệu với mã trạng thái cho trước. */
function respond(fn, status = 200) {
  return async (ctx) => ({ status, data: await fn(ctx) });
}

/** Handler trả về dữ liệu với mã 200. */
const ok = (fn) => respond(fn, 200);

/** Handler tạo mới, trả về mã 201. */
const created = (fn) => respond(fn, 201);

/** Chuyển tham số đường dẫn thành số nguyên dương. */
function toId(value, nhan = 'Mã') {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${nhan} không hợp lệ.`);
  }
  return parsed;
}

/** Chuẩn hóa query string thành object đơn giản. */
function queryParams(ctx) {
  return ctx.query ?? {};
}

module.exports = { respond, ok, created, toId, queryParams };
