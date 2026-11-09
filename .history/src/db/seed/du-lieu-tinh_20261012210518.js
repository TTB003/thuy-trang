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
  ['Lê Thị Hồng', '0912000003', 'hong.lt@gmail.com', '2002-01-30', 'Nữ', '45 Phan Xích Long, Phú Nhuận, TP.HCM', 'Trà sữa'],
  ['Phạm Minh Khoa', '0912000004', 'khoa.pm@gmail.com', '1988-11-07', 'Nam', '203 Võ Văn Ngân, Thủ Đức, TP.HCM', 'Espresso'],
  ['Vũ Thị Ngọc', '0912000005', 'ngoc.vt@gmail.com', '1999-06-19', 'Nữ', '17 Lê Văn Việt, Quận 9, TP.HCM', 'Trà đào'],
  ['Đỗ Văn Thành', '0912000006', 'thanh.dv@gmail.com', '1985-02-14', 'Nam', '56 Quang Trung, Gò Vấp, TP.HCM', 'Cà phê muối'],
  ['Hoàng Thị Yến', '0912000007', 'yen.ht@gmail.com', '2000-09-25', 'Nữ', '31 Ung Văn Khiêm, Bình Thạnh, TP.HCM', 'Đá xay'],
  ['Nguyễn Đức Long', '0912000008', 'long.nd@gmail.com', '1994-12-03', 'Nam', '119 Nguyễn Oanh, Gò Vấp, TP.HCM', 'Latte'],
  ['Bùi Thị Thu', '0912000009', 'thu.bt@gmail.com', '1997-03-16', 'Nữ', '7 Phổ Quang, Tân Bình, TP.HCM', 'Bạc xỉu'],
  ['Đinh Quang Huy', '0912000010', 'huy.dq@gmail.com', '1993-07-08', 'Nam', '64 Hoàng Diệu, Quận 4, TP.HCM', 'Cold Brew'],
  ['Trịnh Thị Lan', '0912000011', 'lan.tt@gmail.com', '2004-05-21', 'Nữ', '25 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', 'Trà xanh matcha'],
  ['Lý Văn Phúc', '0912000012', 'phuc.lv@gmail.com', '1989-10-11', 'Nam', '92 Tô Hiến Thành, Quận 10, TP.HCM', 'Cà phê đen'],
  ['Đặng Thị Bích', '0912000013', 'bich.dt@gmail.com', '1998-02-27', 'Nữ', '38 Điện Biên Phủ, Quận 3, TP.HCM', 'Bánh ngọt'],
  ['Ngô Văn Khánh', '0912000014', 'khanh.nv@gmail.com', '1986-06-05', 'Nam', '150 Âu Cơ, Tân Phú, TP.HCM', 'Americano'],
  ['Phan Thị Diệu', '0912000015', 'dieu.pt@gmail.com', '2001-11-13', 'Nữ', '11 Hoàng Hoa Thám, Tân Bình, TP.HCM', 'Trà sữa'],
  ['Trương Công Định', '0912000016', 'dinh.tc@gmail.com', '1995-01-24', 'Nam', '77 Nguyễn Văn Cừ, Quận 5, TP.HCM', 'Cà phê sữa đá'],
  ['Lâm Thị Hạnh', '0912000017', 'hanh.lt@gmail.com', '1992-04-02', 'Nữ', '29 Lý Thường Kiệt, Quận 10, TP.HCM', 'Cappuccino'],
  ['Hồ Văn Sơn', '0912000018', 'son.hv@gmail.com', '1983-08-17', 'Nam', '101 Nguyễn Kiệm, Phú Nhuận, TP.HCM', 'Cà phê hạt'],
  ['Dương Thị Kim', '0912000019', 'kim.dt@gmail.com', '2003-12-09', 'Nữ', '63 Bùi Thị Xuân, Quận 1, TP.HCM', 'Đá xay'],
  ['Tạ Minh Quân', '0912000020', 'quan.tm@gmail.com', '1990-05-28', 'Nam', '14 Trường Sơn, Tân Bình, TP.HCM', 'Mocha'],
  ['Cao Thị Lệ', '0912000021', 'le.ct@gmail.com', '1996-09-14', 'Nữ', '85 Nguyễn Thượng Hiền, Bình Thạnh, TP.HCM', 'Trà đào'],
  ['Vương Đình Trí', '0912000022', 'tri.vd@gmail.com', '1987-03-31', 'Nam', '40 Lũy Bán Bích, Tân Phú, TP.HCM', 'Espresso'],
  ['Mai Thị Thảo', '0912000023', 'thao.mt@gmail.com', '2005-07-06', 'Nữ', '22 Xô Viết Nghệ Tĩnh, Bình Thạnh, TP.HCM', 'Trà sữa'],
  ['Chu Văn Hải', '0912000024', 'hai.cv@gmail.com', '1984-01-19', 'Nam', '58 Phạm Văn Đồng, Thủ Đức, TP.HCM', 'Cà phê đen'],
  ['Tô Thị Ánh', '0912000025', 'anh.tt@gmail.com', '1999-10-22', 'Nữ', '97 Nơ Trang Long, Bình Thạnh, TP.HCM', 'Bánh cheesecake'],
  ['Đoàn Quốc Việt', '0912000026', 'viet.dq@gmail.com', '1993-06-30', 'Nam', '13 Nguyễn Đình Chiểu, Quận 3, TP.HCM', 'Cold Brew'],
  ['Hà Thị Nhung', '0912000027', 'nhung.ht@gmail.com', '1991-02-11', 'Nữ', '74 Trần Hưng Đạo, Quận 1, TP.HCM', 'Cà phê muối'],
  ['Kiều Văn Tú', '0912000028', 'tu.kv@gmail.com', '1998-08-04', 'Nam', '31 Kha Vạn Cân, Thủ Đức, TP.HCM', 'Trà xanh matcha'],
];

/** Nhóm 9 — KHUYENMAI. Số ngày tính tương đối so với hôm nay. */
const KHUYENMAI = [
  {
    tenKM: 'Khai trương chi nhánh mới',
    moTa: 'Giảm giá cho toàn bộ cà phê Việt Nam',
    giaTriGiam: 5000,
    tuNgay: -25,
    denNgay: 25,
    trangThai: 'Đang diễn ra',
    apDungTuSanPham: 1,
    soSanPham: 6,
  },
  {
    tenKM: 'Combo cà phê sáng',
    moTa: 'Giảm giá cho nhóm cà phê Ý dùng buổi sáng',
    giaTriGiam: 10000,
    tuNgay: -12,
    denNgay: 32,
    trangThai: 'Đang diễn ra',
    apDungTuSanPham: 7,
    soSanPham: 7,
  },
  {
    tenKM: 'Tri ân khách hàng thân thiết',
    moTa: 'Giảm giá cho nhóm trà và trà sữa',
    giaTriGiam: 7000,
    tuNgay: -30,
    denNgay: 15,
    trangThai: 'Đang diễn ra',
    apDungTuSanPham: 14,
    soSanPham: 6,
  },
  {
    tenKM: 'Flash sale cuối tuần trước',
    moTa: 'Chương trình đã kết thúc, dùng để minh hoạ trạng thái hết hạn',
    giaTriGiam: 15000,
    tuNgay: -70,
    denNgay: -35,
    trangThai: 'Đã kết thúc',
    apDungTuSanPham: 20,
    soSanPham: 4,
  },
];

/** Nhóm 11 — Mẫu khảo sát (câu hỏi theo thứ tự). */
const KHAOSAT_MAU = [
  {
    tieuDe: 'Khảo sát mức độ hài lòng quý khách',
    moTa: 'Giúp chúng tôi hiểu rõ trải nghiệm của bạn tại quán',
    loaiKS: 'Mức độ hài lòng',
    doiTuong: 'Tất cả khách hàng',
    hanChot: 30,
    cauHoi: [
      {
        noiDung: 'Bạn đánh giá chất lượng đồ uống như thế nào?',
        loaiCauHoi: 'Thang điểm',
        luaChon: '1|2|3|4|5',
      },
      {
        noiDung: 'Bạn thường ghé quán vào khung giờ nào?',
        loaiCauHoi: 'Một lựa chọn',
        luaChon: 'Sáng sớm (6h-9h)|Giữa ngày (9h-13h)|Chiều (13h-17h)|Tối (17h-21h)',
      },
      {
        noiDung: 'Bạn biết đến quán qua kênh nào?',
        loaiCauHoi: 'Nhiều lựa chọn',
        luaChon: 'Bạn bè giới thiệu|Facebook|TikTok|Đi ngang qua',
      },
      {
        noiDung: 'Điều gì bạn muốn quán cải thiện nhất?',
        loaiCauHoi: 'Trả lời ngắn',
        luaChon: null,
      },
    ],
  },
  {
    tieuDe: 'Thăm dò sản phẩm mới: Cà phê dừa sầu riêng',
    moTa: 'Quán dự kiến ra mắt sản phẩm mới, xin ý kiến khách hàng',
    loaiKS: 'Sản phẩm mới',
    doiTuong: 'Khách hàng thân thiết',
    hanChot: 20,
    cauHoi: [
      {
        noiDung: 'Bạn có sẵn sàng thử cà phê dừa sầu riêng không?',
        loaiCauHoi: 'Một lựa chọn',
        luaChon: 'Rất sẵn sàng|Sẽ thử nếu có khuyến mãi|Không quan tâm|Không thử',
      },
      {
        noiDung: 'Mức giá bạn thấy hợp lý cho sản phẩm này (VND)?',
        loaiCauHoi: 'Một lựa chọn',
        luaChon: 'Dưới 39.000|39.000 - 49.000|49.000 - 59.000|Trên 59.000',
      },
      {
        noiDung: 'Bạn muốn quán ra mắt thêm loại đồ uống nào?',
        loaiCauHoi: 'Trả lời ngắn',
        luaChon: null,
      },
    ],
  },
  {
    tieuDe: 'Khảo sát chương trình khách hàng thân thiết',
    moTa: 'Tìm hiểu cách khách hàng sử dụng điểm tích lũy',
    loaiKS: 'Khác',
    doiTuong: 'Tất cả khách hàng',
    hanChot: 45,
    cauHoi: [
      {
        noiDung: 'Bạn có biết quán có chương trình tích điểm không?',
        loaiCauHoi: 'Một lựa chọn',
        luaChon: 'Có, tôi biết rõ|Có nghe qua|Chưa biết',
      },
      {
        noiDung: 'Bạn muốn dùng điểm để đổi gì nhất?',
        loaiCauHoi: 'Một lựa chọn',
