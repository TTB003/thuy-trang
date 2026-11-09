/**
 * Nạp dữ liệu demo vào cơ sở dữ liệu.
 * Cách chạy: node scripts/seed.js
 * Lưu ý: script sẽ XÓA toàn bộ bảng cũ rồi tạo lại và nạp dữ liệu mẫu.
 */
'use strict';

const db = require('../src/db');
const { seedAll } = require('../src/db/seed');

async function main() {
  const thongTin = db.thongTinKetNoi();
  console.log(`Hệ CSDL: ${thongTin.he} — ${thongTin.moTa}`);
  console.log('Đang tạo bảng và nạp dữ liệu demo...');

  const batDau = Date.now();
  const thongKe = await seedAll({ reset: true });
  const giay = ((Date.now() - batDau) / 1000).toFixed(1);

  console.log('Kết quả nạp dữ liệu:');
  console.log(`  - Loại sản phẩm : ${thongKe.loaiSanPham.length}`);
  console.log(`  - Sản phẩm      : ${thongKe.sanPham}`);
  console.log(`  - Nhà cung cấp  : ${thongKe.nhaCungCap.length}`);
  console.log(`  - Phiếu nhập    : ${thongKe.phieuNhap}`);
  console.log(`  - Đơn hàng      : ${thongKe.donHang}`);
  console.log(`  - Chi tiết đơn  : ${thongKe.chiTietDonHang}`);
  console.log(`  - Giao dịch điểm: ${thongKe.lichSuDiem}`);
  console.log(`  - Phản hồi      : ${thongKe.phanHoi}`);
  console.log(
    `  - Khảo sát      : ${thongKe.khaoSat.soKhaoSat} (${thongKe.khaoSat.soPhieu} phiếu trả lời)`
  );

  console.log('\nTài khoản đăng nhập demo:');
  console.log('  Quản trị (Admin) : admin                / Admin@123');
  console.log('  Quản lý          : an.nv@coffeecrm.vn   / Coffee@123');
  console.log('  Nhân viên        : bich.tt@coffeecrm.vn / Coffee@123');
  console.log('  Khách hàng       : 0912000001           / Khach@123');
  console.log(`\nHoàn tất sau ${giay} giây.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('LỖI NẠP DỮ LIỆU:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
