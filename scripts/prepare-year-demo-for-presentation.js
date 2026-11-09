/** Remove internal sample labels while keeping the generated rows as normal app data. */
'use strict';

const db = require('../src/db');

const ADDRESSES = [
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

async function main() {
  await db.init();
  const summary = await db.transaction(async () => {
    const customers = await db.all(
      `SELECT maKH, sdt FROM KHACHHANG WHERE sdt LIKE '098700%' ORDER BY sdt`
    );
    if (customers.length !== 24) {
      throw new Error(`Cần đúng 24 tài khoản trình diễn theo dải 098700; tìm thấy ${customers.length}.`);
    }
    const customerIds = customers.map((row) => Number(row.maKH));
    const orders = await db.all(
      `SELECT maDH FROM DONHANG WHERE maKH IN (${customerIds.join(',')}) ORDER BY maDH`
    );
    if (orders.length !== 730) {
      throw new Error(`Cần đúng 730 đơn thuộc bộ dữ liệu này; tìm thấy ${orders.length}.`);
    }

    for (let index = 0; index < customers.length; index += 1) {
      const customer = customers[index];
      await db.run(
        `UPDATE KHACHHANG SET diaChi = :diaChi, email = NULL, soThich = :soThich WHERE maKH = :maKH`,
        { diaChi: ADDRESSES[index], soThich: 'Cà phê', maKH: customer.maKH }
      );
    }

    for (const order of orders) {
      await db.run('UPDATE DONHANG SET ghiChu = NULL WHERE maDH = :maDH', { maDH: order.maDH });
      const points = await db.get('SELECT soDiem FROM LICHSUDIEM WHERE maDH = :maDH', { maDH: order.maDH });
      if (!points) throw new Error(`Đơn ${order.maDH} chưa có lịch sử điểm; đã hủy toàn bộ thay đổi.`);
      await db.run(
        'UPDATE LICHSUDIEM SET ghiChu = :ghiChu WHERE maDH = :maDH',
        {
          ghiChu: `Cộng ${points.soDiem} điểm từ sản phẩm trong đơn hàng #${order.maDH}`,
          maDH: order.maDH,
        }
      );
    }

    const supplier = await db.get("SELECT maNCC FROM NHACUNGCAP WHERE sdt = '0987999999'");
    if (!supplier) throw new Error('Không tìm thấy nhà cung cấp gắn với 13 phiếu nhập.');
    await db.run('UPDATE NHACUNGCAP SET email = NULL WHERE maNCC = :maNCC', { maNCC: supplier.maNCC });

    return { customers: customers.length, orders: orders.length, receipts: 13, internalLabelsRemoved: true };
  });

  console.log('Đã chuẩn hóa dữ liệu trình diễn để hiển thị như giao dịch thông thường.');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(`Không thể chuẩn hóa dữ liệu: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closeDb());
