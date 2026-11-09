/**
 * Ứng dụng HTTP: phân phối yêu cầu giữa API JSON và tệp tĩnh của giao diện.
 */
'use strict';

const http = require('node:http');
const { config } = require('./config');
const db = require('./db');
const auth = require('./core/auth');
const { buildRouter } = require('./routes');
const { AppError } = require('./core/errors');
const { serveStatic, serveIndex } = require('./core/static');

const GIOI_HAN_BODY = 2 * 1024 * 1024; // 2 MB
const TEN_COOKIE_PHIEN = 'coffee_crm_token';

/** Đọc và phân tích phần thân JSON của yêu cầu. */
function docBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let kichThuoc = 0;
    req.on('data', (chunk) => {
      kichThuoc += chunk.length;
      if (kichThuoc > GIOI_HAN_BODY) {
        reject(new AppError(413, 'Dữ liệu gửi lên quá lớn.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new AppError(400, 'Dữ liệu JSON gửi lên không hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

/** Lấy token phiên từ header Authorization hoặc cookie. */
function layToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = String(req.headers.cookie ?? '');
  const found = cookies
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${TEN_COOKIE_PHIEN}=`));
  return found ? decodeURIComponent(found.slice(TEN_COOKIE_PHIEN.length + 1)) : null;
}

/** Chuyển query string thành object đơn giản. */
function layQuery(url) {
  const ketQua = {};
  url.searchParams.forEach((value, key) => {
    ketQua[key] = value;
  });
  return ketQua;
}

/** Gửi phản hồi JSON. */
function guiJson(res, status, payload, token = null) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    'Cache-Control': 'no-store',
  };
  if (token !== null && !res.headersSent) {
    headers['Set-Cookie'] = `${TEN_COOKIE_PHIEN}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
  }
  res.writeHead(status, headers);
  res.end(body);
}

/** Gửi phản hồi tĩnh (HTML/CSS/JS...). */
function guiTinh(res, ketQua) {
  res.writeHead(ketQua.status, ketQua.headers);
  res.end(ketQua.body);
}

/** Tạo hàm xử lý yêu cầu HTTP. */
function createRequestHandler() {
  const router = buildRouter();

  return async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const laApi = url.pathname.startsWith('/api/');

    if (!laApi) {
      const tinh = serveStatic(config.publicDir, url.pathname);
      if (tinh) return guiTinh(res, tinh);
      // SPA fallback: mọi đường dẫn không phải tệp đều trả về index.html
      return guiTinh(res, serveIndex(config.publicDir));
    }

    const token = layToken(req);
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await docBody(req);
      const user = auth.resolveUser(token);
      const ctx = {
        req,
        res,
        method: req.method,
        pathname: url.pathname,
        query: layQuery(url),
        params: {},
        body,
        user,
        token,
      };

      const ketQua = await router.execute(ctx);
      const phienMoi = url.pathname === '/api/auth/login' ? ketQua.payload.data?.token ?? null : null;
      if (url.pathname === '/api/auth/logout') {
        res.setHeader(
          'Set-Cookie',
          `${TEN_COOKIE_PHIEN}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
        );
      }
      return guiJson(res, ketQua.status, ketQua.payload, phienMoi);
