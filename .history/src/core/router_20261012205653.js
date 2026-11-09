/**
 * Router HTTP tối giản: khớp method + đường dẫn có tham số, gắn quyền,
 * gom ngữ cảnh request và trả về JSON theo một định dạng thống nhất.
 */
'use strict';

const { AppError, notFound } = require('./errors');
const { assertCapability } = require('./auth');

/** Chuyển '/api/sanpham/:maSP' thành biểu thức chính quy + tên tham số. */
function compilePattern(pattern) {
  const paramNames = [];
  const regexText = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regexText}/?$`), paramNames };
}

class Router {
  constructor() {
    /** @type {Array<{method:string, pattern:string, regex:RegExp, paramNames:string[], capability:string|null, adminOnly:boolean, handler:Function}>} */
    this.routes = [];
  }

  /**
   * @param {string} method
   * @param {string} pattern
   * @param {{capability?: string|null, adminOnly?: boolean, auth?: boolean}} options
   * @param {Function} handler
   */
  add(method, pattern, options, handler) {
    const { regex, paramNames } = compilePattern(pattern);
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      regex,
      paramNames,
      capability: options.capability ?? null,
      adminOnly: options.adminOnly ?? false,
      auth: options.auth ?? false,
      handler,
    });
  }

  get(pattern, options, handler) {
    this.add('GET', pattern, options, handler);
  }

  post(pattern, options, handler) {
    this.add('POST', pattern, options, handler);
  }

  put(pattern, options, handler) {
    this.add('PUT', pattern, options, handler);
  }

  patch(pattern, options, handler) {
    this.add('PATCH', pattern, options, handler);
  }

  delete(pattern, options, handler) {
    this.add('DELETE', pattern, options, handler);
  }

  /** Tìm route khớp với method + pathname. */
  match(method, pathname) {
    const upperMethod = method.toUpperCase();
    for (const route of this.routes) {
      if (route.method !== upperMethod) continue;
      const found = route.regex.exec(pathname);
      if (!found) continue;
      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(found[index + 1]);
      });
      return { route, params };
    }
    return null;
  }

  /**
   * Thực thi route tương ứng với yêu cầu.
   * @param {object} ctx
   * @returns {Promise<{status:number, payload:object}>}
   */
  async execute(ctx) {
    const matched = this.match(ctx.method, ctx.pathname);
    if (!matched) throw notFound(`Không tồn tại API ${ctx.method} ${ctx.pathname}.`);

    const { route, params } = matched;
    ctx.params = params;

    if (route.auth && !ctx.user) {
      throw new AppError(401, 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    if (route.adminOnly && (!ctx.user || ctx.user.vaiTro !== 'Admin')) {
      throw new AppError(403, 'Chức năng này chỉ dành cho quản trị viên (Admin).');
    }
    if (route.capability) assertCapability(ctx.user, route.capability);

    const result = await route.handler(ctx);
    if (result && typeof result === 'object' && 'status' in result && 'data' in result) {
      return { status: result.status, payload: { success: true, data: result.data } };
    }
    return { status: 200, payload: { success: true, data: result ?? null } };
  }
}

module.exports = { Router, compilePattern };
