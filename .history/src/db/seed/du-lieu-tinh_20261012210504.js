/**
 * Dữ liệu demo tĩnh: loại sản phẩm, sản phẩm, nhà cung cấp, nhân viên,
 * khách hàng, khuyến mãi, mẫu khảo sát.
 * Giá tính bằng VND.
 */
'use strict';

/** Nhóm 1 — LOAISANPHAM. */
const LOAISANPHAM = [
  { tenLoai: 'Cà phê Việt Nam', moTa: 'Cà phê phin truyền thống: đen, sữa, bạc xỉu, cà phê muối' },
  { tenLoai: 'Cà phê Ý (Espresso)', moTa: 'Cà phê máy espresso: Americano, Latte, Cappuccino, Cold Brew' },
  { tenLoai: 'Trà & Trà sữa', moTa: 'Trà trái cây, trà sữa, trà thảo mộc' },
  { tenLoai: 'Đồ uống đá xay', moTa: 'Các loại đá xay (frappe) và sinh tố' },
  { tenLoai: 'Bánh ngọt & Bánh mì', moTa: 'Bánh ăn kèm: croissant, tiramisu, cheesecake, bánh mì' },
  { tenLoai: 'Cà phê hạt & Đóng gói', moTa: 'Cà phê hạt rang, cà phê xay bán lẻ mang về' },
];

/** Nhóm 2 — SANPHAM. Cột: maLoai, tenSP, gia, moTa, hinhAnh. */
const SANPHAM = [
  [1, 'Cà phê đen đá', 25000, 'Cà phê phin đá truyền thống, đậm vị Robusta', 'ca-phe-viet'],
  [1, 'Cà phê sữa đá', 29000, 'Cà phê phin với sữa đặc, đá viên', 'ca-phe-viet'],
  [1, 'Bạc xỉu', 32000, 'Nhiều sữa, ít cà phê, vị béo nhẹ', 'ca-phe-viet'],
  [1, 'Cà phê muối', 35000, 'Cà phê sữa kèm lớp kem muối biển', 'ca-phe-viet'],
  [1, 'Cà phê đen nóng', 25000, 'Cà phê phin nóng đậm đà', 'ca-phe-viet'],
  [1, 'Cà phê sữa nóng', 29000, 'Cà phê sữa phin nóng', 'ca-phe-viet'],
  [2, 'Espresso', 35000, 'Một shot espresso nguyên chất', 'espresso'],
  [2, 'Americano', 39000, 'Espresso pha loãng với nước nóng hoặc đá', 'espresso'],
  [2, 'Latte', 45000, 'Espresso với sữa tươi đánh mịn', 'espresso'],
  [2, 'Cappuccino', 45000, 'Espresso, sữa nóng và lớp bọt sữa dày', 'espresso'],
  [2, 'Mocha', 49000, 'Espresso, socola và sữa tươi', 'espresso'],
  [2, 'Cold Brew', 55000, 'Cà phê ủ lạnh 12 giờ, vị thanh nhẹ', 'espresso'],
  [2, 'Caramel Macchiato', 55000, 'Latte với sốt caramel và bọt sữa', 'espresso'],
  [3, 'Trà đào cam sả', 45000, 'Trà đen, đào miếng, cam vàng và sả thơm', 'tra'],
  [3, 'Trà sen vàng', 42000, 'Trà oolong, hạt sen và củ sen', 'tra'],
  [3, 'Trà sữa trân châu', 45000, 'Trà sữa đen kèm trân châu đường đen', 'tra'],
  [3, 'Trà xanh matcha', 48000, 'Matcha Nhật Bản pha sữa tươi', 'tra'],
  [3, 'Trà gừng mật ong', 39000, 'Trà gừng ấm với mật ong rừng', 'tra'],
  [3, 'Trà vải hồng', 45000, 'Trà đen, vải thiều và siro hồng', 'tra'],
  [4, 'Cà phê đá xay', 55000, 'Cà phê xay đá kèm kem tươi', 'da-xay'],
  [4, 'Matcha đá xay', 59000, 'Matcha xay đá kèm kem và hạt', 'da-xay'],
  [4, 'Socola đá xay', 59000, 'Socola Bỉ xay đá kèm kem tươi', 'da-xay'],
  [4, 'Cookie đá xay', 62000, 'Đá xay vị bánh quy giòn', 'da-xay'],
  [5, 'Bánh croissant bơ', 32000, 'Croissant bơ Pháp nướng nóng', 'banh'],
  [5, 'Bánh mì chảo', 39000, 'Bánh mì chảo trứng, xúc xích, pate', 'banh'],
  [5, 'Bánh tiramisu', 45000, 'Tiramisu cà phê truyền thống Ý', 'banh'],
  [5, 'Bánh cheesecake', 45000, 'Cheesecake việt quất, đế bánh quy', 'banh'],
  [6, 'Cà phê hạt Robusta 250g', 135000, 'Hạt Robusta rang vừa, đóng gói 250g', 'hat'],
  [6, 'Cà phê hạt Arabica 250g', 185000, 'Hạt Arabica Cầu Đất rang mộc 250g', 'hat'],
  [6, 'Cà phê xay Blend 500g', 220000, 'Blend 70% Robusta 30% Arabica, xay sẵn 500g', 'hat'],
];

/** Nhóm 3 — NHACUNGCAP. */
const NHACUNGCAP = [
  {
    tenNCC: 'Công ty TNHH Cà phê Trung Nguyên',
    sdt: '02822334455',
    diaChi: '82 Nguyễn Du, Quận 1, TP. Hồ Chí Minh',
    email: 'info@trungnguyen.com.vn',
    trangThai: 'Đang hợp tác',
  },
  {
    tenNCC: 'Công ty CP Cà phê Vinacafe Biên Hoà',
    sdt: '02513889966',
    diaChi: 'KCN Biên Hoà 2, TP. Biên Hoà, Đồng Nai',
    email: 'sales@vinacafe.com.vn',
    trangThai: 'Đang hợp tác',
  },
  {
    tenNCC: 'Công ty TNHH Thực phẩm Á Châu',
    sdt: '0909123456',
    diaChi: '45 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
    email: 'order@achau.com.vn',
    trangThai: 'Đang hợp tác',
  },
  {
    tenNCC: 'Công ty CP Sữa Việt Nam',
    sdt: '02839912345',
    diaChi: '10 Tân Trào, Quận 7, TP. Hồ Chí Minh',
    email: 'b2b@vinamilk.com.vn',
    trangThai: 'Đang hợp tác',
  },
  {
    tenNCC: 'Công ty TNHH Trà & Thảo mộc Đà Lạt',
    sdt: '02633887766',
    diaChi: '12 Trần Phú, TP. Đà Lạt, Lâm Đồng',
    email: 'sales@daltatea.vn',
    trangThai: 'Đang hợp tác',
  },
  {
    tenNCC: 'Công ty CP Bao bì Phương Nam',
    sdt: '02923889911',
    diaChi: 'KCN Trà Nóc, Quận Bình Thuỷ, Cần Thơ',
    email: 'hotro@phuongnam.vn',
    trangThai: 'Ngừng hợp tác',
  },
];

/** Nhóm 4 — NHANVIEN. */
const NHANVIEN = [
  { hoTen: 'Nguyễn Văn An', email: 'an.nv@coffeecrm.vn', chucVu: 'Quản lý', sdt: '0901111222', ngayVao: '2019-03-01' },
  { hoTen: 'Trần Thị Bích', email: 'bich.tt@coffeecrm.vn', chucVu: 'Nhân viên bán hàng', sdt: '0902222333', ngayVao: '2021-06-15' },
  { hoTen: 'Lê Hoàng Cường', email: 'cuong.lh@coffeecrm.vn', chucVu: 'Nhân viên bán hàng', sdt: '0903333444', ngayVao: '2022-02-20' },
  { hoTen: 'Phạm Thu Dung', email: 'dung.pt@coffeecrm.vn', chucVu: 'Nhân viên CSKH', sdt: '0904444555', ngayVao: '2021-11-05' },
  { hoTen: 'Võ Minh Đức', email: 'duc.vm@coffeecrm.vn', chucVu: 'Nhân viên kho', sdt: '0905555666', ngayVao: '2020-08-10' },
  { hoTen: 'Đặng Thị Hằng', email: 'hang.dt@coffeecrm.vn', chucVu: 'Nhân viên bán hàng', sdt: '0906666777', ngayVao: '2023-01-09' },
  { hoTen: 'Bùi Quốc Huy', email: 'huy.bq@coffeecrm.vn', chucVu: 'Nhân viên kho', sdt: '0907777888', ngayVao: '2022-09-12' },
  { hoTen: 'Ngô Thanh Lan', email: 'lan.nt@coffeecrm.vn', chucVu: 'Nhân viên CSKH', sdt: '0908888999', ngayVao: '2023-05-03' },
  { hoTen: 'Hoàng Tuấn Minh', email: 'minh.ht@coffeecrm.vn', chucVu: 'Nhân viên bán hàng', sdt: '0909999000', ngayVao: '2024-02-19' },
];

/** Nhóm 5 — KHACHHANG. Cột: hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich. */
const KHACHHANG = [
  ['Nguyễn Thị Mai', '0912000001', 'mai.nt@gmail.com', '1996-04-12', 'Nữ', '12 Nguyễn Trãi, Quận 5, TP.HCM', 'Cà phê sữa đá'],
  ['Trần Quốc Bảo', '0912000002', 'bao.tq@gmail.com', '1991-08-23', 'Nam', '88 Cách Mạng Tháng 8, Quận 3, TP.HCM', 'Cà phê đen'],
