/**
 * Điểm khởi động ứng dụng.
 * Cách chạy: node server.js     (hoặc: npm start)
 */
'use strict';

const { startServer } = require('./src/app');
const { config } = require('./src/config');
const db = require('./src/db');

async function main() {
  const thongTin = db.thongTinKetNoi();
  console.log('=============================================================');
  console.log('  HỆ THỐNG DOANH NGHIỆP BÁN COFFEE');
  console.log('=============================================================');
  console.log(`  Cơ sở dữ liệu : ${thongTin.he} — ${thongTin.moTa}`);
  console.log(`  Địa chỉ web   : http://${config.host}:${config.port}`);
  console.log('  Dừng máy chủ  : nhấn Ctrl + C');
  console.log('=============================================================');

  await startServer({ port: config.port, host: config.host });
  console.log('Máy chủ đang chạy. Mở trình duyệt tại địa chỉ trên để sử dụng.');
}

main().catch((error) => {
  console.error('KHÔNG KHỞI ĐỘNG ĐƯỢC MÁY CHỦ:', error.message);
  if (String(error.message).includes('ECONNREFUSED') || String(error.message).includes('password')) {
    console.error('Kiểm tra lại PostgreSQL: máy chủ đã bật chưa, mật khẩu/host/cổng trong src/config.js đúng chưa.');
  }
  process.exit(1);
});
