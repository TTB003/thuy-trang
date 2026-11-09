/**
 * Append one year of synthetic transactions using the app's normal customer/order flows.
 * Run: node scripts/seed-one-year-demo.js
 * The script is additive and refuses to run twice; it never truncates or resets data.
 */
'use strict';

const db = require('../src/db');
const auth = require('../src/core/auth');
const { ROLES } = require('../src/config');

const PHONE_PREFIX = '098700';
const START = new Date(Date.UTC(2025, 10, 4));
const DAYS = 365;
const CUSTOMER_COUNT = 24;
const CUSTOMER_NAMES = [
  'Nguyễn Minh Anh', 'Trần Quốc Bảo', 'Lê Thanh Hằng', 'Phạm Gia Huy',
  'Võ Ngọc Lan', 'Đặng Hoàng Nam', 'Bùi Thảo Nhi', 'Đỗ Thành Đạt',
  'Hồ Mỹ Duyên', 'Ngô Tuấn Kiệt', 'Dương Khánh Linh', 'Lý Đức Minh',
  'Phan Thu Trang', 'Trương Nhật Quang', 'Mai Phương Thảo', 'Cao Anh Tuấn',
  'Huỳnh Bảo Châu', 'Vũ Thanh Tùng', 'Đinh Ngọc Hà', 'Tạ Minh Khang',
  'Châu Hoài An', 'Đoàn Quốc Việt', 'Tôn Như Quỳnh', 'Lâm Hải Đăng',
];
const CUSTOMER_ADDRESSES = [
  '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', '25 Lê Lợi, Quận Hải Châu, TP. Đà Nẵng',
  '18 Trần Phú, Quận Hoàn Kiếm, TP. Hà Nội', '41 Nguyễn Văn Cừ, Quận Ninh Kiều, TP. Cần Thơ',
  '36 Lê Duẩn, TP. Buôn Ma Thuột, Đắk Lắk', '22 Phan Chu Trinh, TP. Hội An, Quảng Nam',
  '58 Hai Bà Trưng, TP. Đà Lạt, Lâm Đồng', '17 Võ Thị Sáu, TP. Vũng Tàu, Bà Rịa - Vũng Tàu',
  '63 Nguyễn Trãi, Quận Thanh Xuân, TP. Hà Nội', '29 Điện Biên Phủ, Quận Bình Thạnh, TP. Hồ Chí Minh',
  '44 Hùng Vương, TP. Huế, Thừa Thiên Huế', '31 Lý Thường Kiệt, TP. Quy Nhơn, Bình Định',
  '72 Nguyễn Thị Minh Khai, TP. Nha Trang, Khánh Hòa', '15 Cách Mạng Tháng Tám, TP. Biên Hòa, Đồng Nai',
  '39 Trần Hưng Đạo, TP. Phan Thiết, Bình Thuận', '26 Nguyễn Tất Thành, TP. Pleiku, Gia Lai',
  '51 Bạch Đằng, Quận Hải Châu, TP. Đà Nẵng', '33 Lê Lợi, TP. Vinh, Nghệ An',
  '19 Nguyễn Đình Chiểu, TP. Mỹ Tho, Tiền Giang', '84 Phạm Văn Đồng, TP. Thủ Đức, TP. Hồ Chí Minh',
  '27 Hoàng Diệu, TP. Long Xuyên, An Giang', '46 Nguyễn Huệ, TP. Tuy Hòa, Phú Yên',
  '11 Trần Hưng Đạo, TP. Rạch Giá, Kiên Giang', '55 Lê Hồng Phong, TP. Bảo Lộc, Lâm Đồng',
];

function dateSql(date, hour = 12, minute = 0) {
  const value = new Date(date);
  value.setUTCHours(hour, minute, 0, 0);
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function random(seed) {
  let state = seed >>> 0;
  return (max) => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state % max;
  };
}

async function main() {
  await db.init();
  const summary = await db.transaction(async () => {
    const existing = Number(await db.scalar(
      'SELECT COUNT(*) FROM KHACHHANG WHERE sdt LIKE :prefix',
      { prefix: `${PHONE_PREFIX}%` }
    ));
    if (existing > 0) {
      throw new Error(`Đã có ${existing} khách thuộc bộ dữ liệu này; dừng để tránh chèn trùng.`);
    }

    const products = (await db.all('SELECT maSP, tenSP, gia FROM SANPHAM WHERE trangThai = :status ORDER BY maSP', {
      status: 'Đang bán',
    })).filter((product) => Number(product.gia) > 0);
    const employees = (await db.all('SELECT maNV, chucVu FROM NHANVIEN WHERE trangThai = :status ORDER BY maNV', {
      status: 'Đang làm việc',
    })).filter((employee) => ['Nhân viên bán hàng', 'Quản lý', 'Admin'].includes(employee.chucVu));
    if (products.length < 1) throw new Error('Cần ít nhất 1 sản phẩm đang bán để tạo dữ liệu demo.');
    if (!employees.length) throw new Error('Không tìm thấy nhân viên bán hàng đang làm việc.');

    const customerRows = await db.all('SELECT sdt FROM KHACHHANG');
    const usedPhones = new Set(customerRows.map((row) => row.sdt));
    const customers = [];
    for (let index = 0; index < CUSTOMER_COUNT; index += 1) {
      const phone = `098700${String(index + 1).padStart(4, '0')}`;
      if (usedPhones.has(phone)) throw new Error(`Số điện thoại demo ${phone} đã tồn tại; không thay đổi dữ liệu.`);
      const customer = await db.run(
        `INSERT INTO KHACHHANG (hoTen, sdt, email, gioiTinh, diaChi, soThich, diemTichLuy, ngayMuaHangCuoi, trangThai, ngayDangKy)
         VALUES (:hoTen, :sdt, :email, :gioiTinh, :diaChi, :soThich, 0, NULL, :trangThai, :ngayDangKy)`,
        {
          hoTen: CUSTOMER_NAMES[index],
          sdt: phone,
          email: null,
          gioiTinh: index % 2 === 0 ? 'Nam' : 'Nữ',
          diaChi: CUSTOMER_ADDRESSES[index],
          soThich: 'Cà phê',
          trangThai: 'Hoạt động',
          ngayDangKy: dateSql(new Date(START.getTime() - 5 * 86400000 + index * 3600000)),
        }
      );
      const ngayTaoTaiKhoan = new Date(START.getTime() - 5 * 86400000 + index * 3600000);
      await auth.createAccount({
        tenDangNhap: phone,
        matKhau: 'Khach@123',
        vaiTro: ROLES.CUSTOMER,
        maKH: customer.lastInsertRowid,
      });
      await db.run('UPDATE TAIKHOAN SET ngayTao = :ngayTao WHERE maKH = :maKH', {
        ngayTao: dateSql(ngayTaoTaiKhoan),
        maKH: customer.lastInsertRowid,
      });
      customers.push({ maKH: customer.lastInsertRowid, points: 0, lastPurchase: null });
    }

    let supplier = await db.get('SELECT maNCC FROM NHACUNGCAP WHERE tenNCC = :name', {
      name: 'Công ty TNHH Cung ứng Cà phê Tây Nguyên',
    });
    if (!supplier) {
      supplier = await db.run(
        `INSERT INTO NHACUNGCAP (tenNCC, sdt, diaChi, email, trangThai)
         VALUES (:name, :phone, :address, :email, :status)`,
        {
          name: 'Công ty TNHH Cung ứng Cà phê Tây Nguyên',
          phone: '0987999999',
          address: 'TP. Buôn Ma Thuột, Đắk Lắk',
          email: null,
          status: 'Đang hợp tác',
        }
      );
      supplier = { maNCC: supplier.lastInsertRowid };
    }

    const pick = random(20261103);
    const dailyOrders = [];
    const monthlyItems = new Map();
    let orderCount = 0;
    let detailCount = 0;
    let pointCount = 0;
    let revenue = 0;

    for (let day = 0; day < DAYS; day += 1) {
      const orderDate = new Date(START);
      orderDate.setUTCDate(orderDate.getUTCDate() + day);
      for (let slot = 0; slot < 2; slot += 1) {
        const customer = customers[(day * 2 + slot) % customers.length];
        const employee = employees[(day * 2 + slot) % employees.length];
        const lineCount = 1 + pick(Math.min(3, products.length));
        const chosen = new Set();
        while (chosen.size < lineCount) chosen.add(pick(products.length));
        const lines = [...chosen].map((productIndex) => {
          const product = products[productIndex];
          const quantity = 1 + pick(3);
          const price = Number(product.gia);
          const amount = price * quantity;
          const monthKey = `${orderDate.getUTCFullYear()}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}`;
          if (!monthlyItems.has(monthKey)) monthlyItems.set(monthKey, new Map());
          const monthly = monthlyItems.get(monthKey);
          const current = monthly.get(product.maSP) ?? { product, quantity: 0 };
          current.quantity += quantity;
          monthly.set(product.maSP, current);
          return { product, quantity, price, amount };
        });
        const total = lines.reduce((sum, line) => sum + line.amount, 0);
        const timestamp = dateSql(orderDate, 8 + pick(13), pick(60));
        dailyOrders.push({ customer, employee, lines, total, timestamp, slot });
      }
    }

    // Create monthly receiving slips with quantities matching the simulated sales.
    for (const [monthKey, items] of monthlyItems) {
      const [year, month] = monthKey.split('-').map(Number);
      const receiptDate = dateSql(new Date(Date.UTC(year, month - 1, 1)), 7);
      const receiptLines = [...items.values()].map(({ product, quantity }) => ({
        product,
        quantity,
        price: Math.round(Number(product.gia) * 0.55),
      }));
      const total = receiptLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const receipt = await db.run(
        `INSERT INTO PHIEUNGUONHANG (maNCC, maNV, ngayNhap, tongTien, trangThai)
         VALUES (:maNCC, :maNV, :ngayNhap, :tongTien, :trangThai)`,
        {
          maNCC: supplier.maNCC,
          maNV: employees[0].maNV,
          ngayNhap: receiptDate,
          tongTien: total,
          trangThai: 'Hoàn thành',
        }
      );
      for (const line of receiptLines) {
        await db.run(
          `INSERT INTO CTPNH (maPNH, maSP, soLuong, donGia, thanhTien)
           VALUES (:maPNH, :maSP, :soLuong, :donGia, :thanhTien)`,
          {
            maPNH: receipt.lastInsertRowid,
            maSP: line.product.maSP,
            soLuong: line.quantity,
            donGia: line.price,
            thanhTien: line.price * line.quantity,
          }
        );
      }
    }

    for (let index = 0; index < dailyOrders.length; index += 1) {
      const order = dailyOrders[index];
      const orderResult = await db.run(
        `INSERT INTO DONHANG (maKH, maNV, ngayDat, tongTien, tienHang, diemSuDung, tienGiamDiem,
                              hinhThuc, phuongThucThanhToan, ghiChu, trangThai)
         VALUES (:maKH, :maNV, :ngayDat, :tongTien, :tienHang, 0, 0, :hinhThuc, :payment, :ghiChu, :status)`,
        {
          maKH: order.customer.maKH,
          maNV: order.employee.maNV,
          ngayDat: order.timestamp,
          tongTien: order.total,
          tienHang: order.total,
          hinhThuc: index % 3 === 0 ? 'Giao hàng' : 'Tại quán',
          payment: index % 2 === 0 ? 'Tiền mặt' : 'Chuyển khoản',
          ghiChu: null,
          status: 'Hoàn thành',
        }
      );
      const maDH = orderResult.lastInsertRowid;
      const soDiem = order.lines.reduce((sum, line) => sum + line.quantity, 0);
      for (const line of order.lines) {
        await db.run(
          `INSERT INTO CHITIETDONHANG (maDH, maSP, soLuong, donGia, thanhTien)
           VALUES (:maDH, :maSP, :soLuong, :donGia, :thanhTien)`,
          {
            maDH,
            maSP: line.product.maSP,
            soLuong: line.quantity,
            donGia: line.price,
            thanhTien: line.amount,
          }
        );
        detailCount += 1;
      }
      await db.run(
        `INSERT INTO LICHSUDIEM (maKH, maDH, soDiem, loaiGD, ghiChu, ngayGD)
         VALUES (:maKH, :maDH, :soDiem, :loaiGD, :ghiChu, :ngayGD)`,
        {
          maKH: order.customer.maKH,
          maDH,
          soDiem,
          loaiGD: 'Cộng',
          ghiChu: `Cộng ${soDiem} điểm từ ${soDiem} sản phẩm của đơn hàng #${maDH}`,
          ngayGD: order.timestamp,
        }
      );
      order.customer.points += soDiem;
      order.customer.lastPurchase = order.timestamp;
      pointCount += soDiem;
      revenue += order.total;
      orderCount += 1;
    }

    for (const customer of customers) {
      await db.run(
        `UPDATE KHACHHANG SET diemTichLuy = :points, ngayMuaHangCuoi = :lastPurchase,
                              ngayNhacHetHanDiem = NULL WHERE maKH = :maKH`,
        { points: customer.points, lastPurchase: customer.lastPurchase, maKH: customer.maKH }
      );
    }

    return {
      period: `${dateSql(START).slice(0, 10)} đến ${dateSql(new Date(Date.UTC(2026, 10, 3))).slice(0, 10)}`,
      orders: orderCount,
      orderLines: detailCount,
      receiptSlips: monthlyItems.size,
      demoCustomers: customers.length,
      loyaltyPoints: pointCount,
      revenue,
    };
  });

  console.log('Đã thêm khách hàng, đơn hàng, phiếu nhập và điểm tích lũy theo dữ liệu giao dịch thông thường:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(`Không thể thêm dữ liệu demo: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closeDb());
