/** Prepare generated one-year customers and accounts with ordinary presentation data. */
'use strict';

const db = require('../src/db');
const auth = require('../src/core/auth');
const { ROLES } = require('../src/config');

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

function truMotNgay(timestamp) {
  const [datePart, timePart] = String(timestamp).split(' ');
  const date = new Date(`${datePart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.toISOString().slice(0, 10)} ${timePart ?? '12:00:00'}`;
}

async function main() {
  await db.init();
  const result = await db.transaction(async () => {
    const customers = await db.all(
      `SELECT k.maKH, k.sdt, MIN(d.ngayDat) AS ngayDat
         FROM KHACHHANG k
         JOIN DONHANG d ON d.maKH = k.maKH
        WHERE k.sdt LIKE '098700%'
        GROUP BY k.maKH, k.sdt
        ORDER BY k.sdt`
    );
    if (customers.length !== CUSTOMER_NAMES.length) {
      throw new Error(`Cần đúng 24 khách mô phỏng có đơn hàng; hiện tìm thấy ${customers.length}. Dừng để giữ nguyên dữ liệu.`);
    }

    let createdAccounts = 0;
    for (let index = 0; index < customers.length; index += 1) {
      const customer = customers[index];
      const ngayDangKy = truMotNgay(customer.ngayDat);
      await db.run(
        `UPDATE KHACHHANG
          SET hoTen = :hoTen, email = NULL, diaChi = :diaChi, soThich = :soThich, ngayDangKy = :ngayDangKy
          WHERE maKH = :maKH`,
        {
          hoTen: CUSTOMER_NAMES[index],
          diaChi: CUSTOMER_ADDRESSES[index],
          soThich: 'Cà phê',
          ngayDangKy,
          maKH: customer.maKH,
        }
      );

      const account = await db.get('SELECT maTK FROM TAIKHOAN WHERE maKH = :maKH', {
        maKH: customer.maKH,
      });
      if (account) {
        await db.run('UPDATE TAIKHOAN SET ngayTao = :ngayTao WHERE maTK = :maTK', {
          ngayTao: ngayDangKy,
          maTK: account.maTK,
        });
      } else {
        await auth.createAccount({
          tenDangNhap: customer.sdt,
          matKhau: 'Khach@123',
          vaiTro: ROLES.CUSTOMER,
          maKH: customer.maKH,
        });
        await db.run('UPDATE TAIKHOAN SET ngayTao = :ngayTao WHERE maKH = :maKH', {
          ngayTao: ngayDangKy,
          maKH: customer.maKH,
        });
        createdAccounts += 1;
      }
    }

    const supplier = await db.get("SELECT maNCC FROM NHACUNGCAP WHERE sdt = '0987999999'");
    if (supplier) {
      await db.run(
        `UPDATE NHACUNGCAP
            SET tenNCC = :tenNCC, sdt = :sdt, diaChi = :diaChi, email = :email
          WHERE maNCC = :maNCC`,
        {
          tenNCC: 'Công ty TNHH Cung ứng Cà phê Tây Nguyên',
          sdt: '0987999999',
          diaChi: 'TP. Buôn Ma Thuột, Đắk Lắk',
          email: null,
          maNCC: supplier.maNCC,
        }
      );
    }

    return { customers: customers.length, createdAccounts, supplierRenamed: Boolean(supplier) };
  });

  console.log('Đã đồng bộ hồ sơ khách với tài khoản, ngày tạo và đơn mua đầu tiên.');
  console.log(JSON.stringify(result, null, 2));
  console.log('Tài khoản khách: đăng nhập bằng số điện thoại, mật khẩu mặc định Khach@123. Mật khẩu được băm trong CSDL.');
}

main()
  .catch((error) => {
    console.error(`Không thể sửa dữ liệu: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.closeDb());
