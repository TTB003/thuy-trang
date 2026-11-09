/**
 * Phục vụ tệp tĩnh (HTML, CSS, JS, hình ảnh) từ thư mục public/.
 * Có kiểm tra chống truy cập ra ngoài thư mục (path traversal).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
};

/** Lấy MIME type theo phần mở rộng. */
function mimeTypeOf(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Giải một URL thành đường dẫn tệp an toàn trong thư mục gốc.
 * Trả về null nếu đường dẫn nằm ngoài thư mục gốc.
 */
function resolveSafePath(rootDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const fullPath = path.join(rootDir, normalized);
  const rootResolved = path.resolve(rootDir);
  if (!path.resolve(fullPath).startsWith(rootResolved)) return null;
  return fullPath;
}

/**
 * Trả về nội dung tệp tĩnh tương ứng.
 * @returns {{ status:number, body:Buffer|string, headers:Record<string,string> }|null}
 */
function serveStatic(publicDir, urlPath) {
  const candidate = resolveSafePath(publicDir, urlPath);
  if (!candidate) return null;

  let target = candidate;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;

  const body = fs.readFileSync(target);
  const headers = {
    'Content-Type': mimeTypeOf(target),
    'Content-Length': String(body.length),
    'Cache-Control': 'no-cache',
  };
  if (path.extname(target).toLowerCase() === '.apk') {
    headers['Content-Disposition'] = `attachment; filename="${path.basename(target)}"`;
  }
  return {
    status: 200,
    body,
    headers,
  };
}

/** Trả về nội dung index.html (dùng cho SPA fallback). */
function serveIndex(publicDir) {
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return {
      status: 404,
      body: '<!doctype html><meta charset="utf-8"><h1>Chưa có giao diện</h1><p>Thiếu tệp public/index.html</p>',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    };
  }
  const body = fs.readFileSync(indexPath);
  return {
    status: 200,
    body,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(body.length),
      'Cache-Control': 'no-cache',
    },
  };
}

module.exports = { serveStatic, serveIndex, mimeTypeOf, resolveSafePath, MIME_TYPES };
