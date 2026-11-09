/**
 * Sinh dữ liệu demo đầy đủ cho toàn bộ 21 bảng.
 * Chạy: node scripts/seed.js
 * Dữ liệu sinh theo bộ số ngẫu nhiên TẤT ĐỊNH nên chạy lại cho kết quả giống nhau.
 */
'use strict';

const db = require('../index');
const auth = require('../../core/auth');
const { ROLES, VND_PER_POINT, VND_PER_POINT_REDEEM } = require('../../config');
const tinh = require('./du-lieu-tinh');
const { NgauNhien, ngayGioCachHomNay, ngayThangCachHomNay } = require('./tien-ich');

/** Mật khẩu mặc định của tài khoản demo. */
const MAT_KHAU_NHAN_VIEN = 'Coffee@123';
const MAT_KHAU_KHACH_HANG = 'Khach@123';
const MAT_KHAU_ADMIN = 'Admin@123';

/** Số phiếu nhập và số đơn hàng sinh ra. */
const SO_PHIEU_NHAP = 16;
const SO_DON_HANG = 110;
/** Số ngày gần nhất được xem là "đang xử lý". */
const NGAY_GAN_NHAT = 8;

/**
 * Chèn toàn bộ dữ liệu demo.
 * @param {{ reset?: boolean }} [options] reset=false sẽ không xóa bảng trước khi chèn.
 * @returns {Promise<object>} thống kê số bản ghi đã tạo
 */
async function seedAll(options = {}) {
  const { reset = true } = options;
  if (reset) await db.initSchema();

  const rnd = new NgauNhien(20262026);
  const thongKe = {};

  return db.transaction(async () => {
    thongKe.loaiSanPham = await chenLoaiSanPham();
    const sanPham = await chenSanPham();
    thongKe.sanPham = sanPham.length;
    thongKe.nhaCungCap = await chenNhaCungCap();
    const nhanVien = await chenNhanVienVaTaiKhoan();
    await chenTaiKhoanAdmin();
    const khachHang = await chenKhachHangVaTaiKhoan();
    const khuyenMai = await chenKhuyenMai(sanPham);

    const kho = new Map(sanPham.map((sp) => [sp.maSP, 0]));
    thongKe.phieuNhap = await chenPhieuNhap(rnd, kho, sanPham);
    const ketQuaBan = await chenDonHang(rnd, kho, sanPham, khachHang, nhanVien, khuyenMai);
    thongKe.donHang = ketQuaBan.soDonHang;
    thongKe.chiTietDonHang = ketQuaBan.soChiTiet;
    thongKe.lichSuDiem = ketQuaBan.soGiaoDichDiem;

    await capNhatTonKhoCuoi(kho);
    await datTonKhoCanhBao(sanPham);
    thongKe.phanHoi = await chenPhanHoi(rnd, sanPham, khachHang, nhanVien);
    thongKe.khaoSat = await chenKhaoSat(rnd, khachHang, nhanVien);

    return thongKe;
  });
}

/** Nhóm 1 — chèn loại sản phẩm. */
async function chenLoaiSanPham() {
  const maLoai = [];
  for (const loai of tinh.LOAISANPHAM) {
    const ketQua = await db.run(
      'INSERT INTO LOAISANPHAM (tenLoai, moTa) VALUES (:tenLoai, :moTa)',
      { tenLoai: loai.tenLoai, moTa: loai.moTa }
    );
    maLoai.push(ketQua.lastInsertRowid);
  }
  return maLoai;
}

/** Nhóm 2 — chèn sản phẩm (tồn kho ban đầu 0, cập nhật sau khi nhập hàng). */
async function chenSanPham() {
  const danhSach = [];
  for (const [maLoai, tenSP, gia, moTa, hinhAnh] of tinh.SANPHAM) {
    const ketQua = await db.run(
      `INSERT INTO SANPHAM (maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai)
       VALUES (:maLoai, :tenSP, :moTa, :gia, 0, :hinhAnh, N'Đang bán')`,
      { maLoai, tenSP, moTa, gia, hinhAnh }
    );
    danhSach.push({ maSP: ketQua.lastInsertRowid, maLoai, tenSP, gia, hinhAnh });
  }
  return danhSach;
}

/** Nhóm 3 — chèn nhà cung cấp. */
async function chenNhaCungCap() {
  const danhSach = [];
  for (const ncc of tinh.NHACUNGCAP) {
    const ketQua = await db.run(
      `INSERT INTO NHACUNGCAP (tenNCC, sdt, diaChi, email, trangThai)
       VALUES (:tenNCC, :sdt, :diaChi, :email, :trangThai)`,
      ncc
    );
    danhSach.push({ maNCC: ketQua.lastInsertRowid, ...ncc });
  }
  return danhSach;
}

/** Nhóm 4 — chèn nhân viên kèm tài khoản đăng nhập. */
async function chenNhanVienVaTaiKhoan() {
  const danhSach = [];
  for (const nhanVien of tinh.NHANVIEN) {
    const ketQua = await db.run(
      `INSERT INTO NHANVIEN (hoTen, email, chucVu, sdt, ngayVao, trangThai)
       VALUES (:hoTen, :email, :chucVu, :sdt, :ngayVao, N'Đang làm việc')`,
      nhanVien
    );
    const maNV = ketQua.lastInsertRowid;
    await auth.createAccount({
      tenDangNhap: nhanVien.email,
      matKhau: MAT_KHAU_NHAN_VIEN,
      vaiTro: nhanVien.chucVu === 'Quản lý' ? ROLES.MANAGER : ROLES.STAFF,
      maNV,
    });
    danhSach.push({ maNV, ...nhanVien });
  }
  return danhSach;
}

/** Tài khoản quản trị hệ thống (giao diện ADMIN). */
async function chenTaiKhoanAdmin() {
  const daCo = await db.get(`SELECT maTK FROM TAIKHOAN WHERE vaiTro = 'Admin'`);
  if (daCo) return daCo.maTK;
  return auth.createAccount({
    tenDangNhap: 'admin',
    matKhau: MAT_KHAU_ADMIN,
    vaiTro: ROLES.ADMIN,
  });
}

/** Nhóm 5 — chèn khách hàng kèm tài khoản đăng nhập. */
async function chenKhachHangVaTaiKhoan() {
  const danhSach = [];
  let index = 0;
  for (const [hoTen, sdt, emailValue, ngaySinh, gioiTinh, diaChi, soThich] of tinh.KHACHHANG) {
    const soNgayDangKy = -(180 - index * 5);
    const ketQua = await db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', :ngayDangKy)`,
      {
        hoTen,
        sdt,
        email: emailValue,
        ngaySinh,
        gioiTinh,
        diaChi,
        soThich,
        ngayDangKy: ngayGioCachHomNay(soNgayDangKy, 9 + (index % 8), 15, 0),
      }
    );
    const maKH = ketQua.lastInsertRowid;
    await auth.createAccount({
      tenDangNhap: sdt,
      matKhau: MAT_KHAU_KHACH_HANG,
      vaiTro: ROLES.CUSTOMER,
      maKH,
    });
    danhSach.push({ maKH, hoTen, sdt, email: emailValue, soThich, biKhoa: false });
    index += 1;
  }

  // Một khách hàng bị khóa để minh hoạ chức năng CN5.3.
  const khachBiKhoa = danhSach[danhSach.length - 1];
  await db.run(`UPDATE KHACHHANG SET trangThai = N'Bị khóa' WHERE maKH = :maKH`, {
    maKH: khachBiKhoa.maKH,
  });
  await db.run(`UPDATE TAIKHOAN SET trangThai = 'Bị khóa' WHERE maKH = :maKH`, {
    maKH: khachBiKhoa.maKH,
  });
  khachBiKhoa.biKhoa = true;

  return danhSach;
}

/** Nhóm 9 — chèn chương trình khuyến mãi và chi tiết áp dụng. */
async function chenKhuyenMai(sanPham) {
  const danhSach = [];
  for (const km of tinh.KHUYENMAI) {
    const ngayBatDau = ngayThangCachHomNay(km.tuNgay);
    const ngayKetThuc = ngayThangCachHomNay(km.denNgay);
    const ketQua = await db.run(
      `INSERT INTO KHUYENMAI (tenKM, moTa, giaTriGiam, ngayBatDau, ngayKetThuc, trangThai)
       VALUES (:tenKM, :moTa, :giaTriGiam, :ngayBatDau, :ngayKetThuc, :trangThai)`,
      {
        tenKM: km.tenKM,
        moTa: km.moTa,
        giaTriGiam: km.giaTriGiam,
        ngayBatDau,
        ngayKetThuc,
        trangThai: km.trangThai,
      }
    );
    const maKM = ketQua.lastInsertRowid;
    const batDauIndex = km.apDungTuSanPham - 1;
    const danhSachApDung = sanPham.slice(batDauIndex, batDauIndex + km.soSanPham);
    for (const sp of danhSachApDung) {
      await db.run('INSERT INTO CTKM (maKM, maSP) VALUES (:maKM, :maSP)', { maKM, maSP: sp.maSP });
    }
    danhSach.push({
      maKM,
      tenKM: km.tenKM,
      giaTriGiam: km.giaTriGiam,
      ngayBatDau,
      ngayKetThuc,
      danhSachMaSP: danhSachApDung.map((sp) => sp.maSP),
    });
  }
  return danhSach;
}
/** Sinh phiếu nhập hàng (nhóm 6) và cộng tồn kho. */
async function chenPhieuNhap(rnd, kho, sanPham) {
  const khachNCC = tinh.NHACUNGCAP.filter((item) => item.trangThai === 'Đang hợp tác');
  let soPhieu = 0;

  for (let i = 0; i < SO_PHIEU_NHAP; i += 1) {
    const soNgay = -(210 - i * 12);
    const ngayNhap = ngayGioCachHomNay(soNgay, 8 + (i % 4), 30, 0);
    const maNCC = tinh.NHACUNGCAP.indexOf(rnd.chon(khachNCC)) + 1;
    const maNV = 5 + (i % 3); // nhân viên kho / quản lý
    const laMoiNhat = i === SO_PHIEU_NHAP - 1;
    const trangThai = laMoiNhat ? 'Chờ duyệt' : 'Hoàn thành';

    const ketQua = await db.run(
      `INSERT INTO PHIEUNGUONHANG (maNCC, maNV, ngayNhap, tongTien, trangThai)
       VALUES (:maNCC, :maNV, :ngayNhap, 0, :trangThai)`,
      { maNCC, maNV, ngayNhap, trangThai }
    );
    const maPNH = ketQua.lastInsertRowid;

    const matHang = rnd.chonNhieu(sanPham, rnd.soNguyen(3, 5));
    let tongTien = 0;
    for (const sp of matHang) {
      const soLuong = rnd.soNguyen(80, 300);
      // Giá nhập bằng 55%-70% giá bán, làm tròn tới 500đ.
      const tyLe = rnd.soNguyen(55, 70) / 100;
      const donGia = Math.round((sp.gia * tyLe) / 500) * 500;
      const thanhTien = soLuong * donGia;
      tongTien += thanhTien;
      await db.run(
        `INSERT INTO CTPNH (maPNH, maSP, soLuong, donGia, thanhTien)
         VALUES (:maPNH, :maSP, :soLuong, :donGia, :thanhTien)`,
        { maPNH, maSP: sp.maSP, soLuong, donGia, thanhTien }
      );
      if (trangThai === 'Hoàn thành') {
        kho.set(sp.maSP, (kho.get(sp.maSP) ?? 0) + soLuong);
      }
    }
    await db.run('UPDATE PHIEUNGONHANG SET tongTien = :tongTien WHERE maPNH = :maPNH', {
      tongTien,
      maPNH,
    });
    soPhieu += 1;
  }
  return soPhieu;
}

/** Lấy giá bán đã trừ khuyến mãi còn hiệu lực tại thời điểm bán. */
function giaBanTaiThoiDiem(sanPham, khuyenMai, ngayBan) {
  const ngay = ngayBan.slice(0, 10);
  let giamGia = 0;
  for (const km of khuyenMai) {
    if (!km.danhSachMaSP.includes(sanPham.maSP)) continue;
    if (ngay < km.ngayBatDau || ngay > km.ngayKetThuc) continue;
    giamGia = Math.max(giamGia, km.giaTriGiam);
  }
  return Math.max(0, sanPham.gia - giamGia);
}

/** Sinh đơn hàng và chi tiết (nhóm 7), đồng thời sinh lịch sử điểm (nhóm 8). */
async function chenDonHang(rnd, kho, sanPham, khachHang, nhanVien, khuyenMai) {
  const nhanVienBanHang = nhanVien.filter(
    (nv) => nv.chucVu === 'Nhân viên bán hàng' || nv.chucVu === 'Quản lý'
  );
  const khachHoatDong = khachHang.filter((kh) => !kh.biKhoa);
  const diemTheoKhach = new Map(khachHoatDong.map((kh) => [kh.maKH, 0]));
  let soDonHang = 0;
  let soChiTiet = 0;
  let soGiaoDichDiem = 0;

  for (let i = 0; i < SO_DON_HANG; i += 1) {
    const soNgay = -(200 - Math.floor((i * 200) / SO_DON_HANG));
    const ngayDat = ngayGioCachHomNay(soNgay, rnd.soNguyen(7, 20), rnd.soNguyen(0, 59), 0);
    const khach = rnd.chon(khachHoatDong);
    const nv = rnd.chon(nhanVienBanHang);
    const hinhThuc = rnd.xacSuat(0.35) ? 'Giao hàng' : 'Tại quán';

    // Chọn tối đa 4 mặt hàng còn đủ tồn kho.
    const ungVien = rnd.chonNhieu(sanPham, 6);
    const dongHang = [];
    let tienHang = 0;
    for (const sp of ungVien) {
      if (dongHang.length >= 4) break;
      const soLuong = rnd.soNguyen(1, 3);
      if ((kho.get(sp.maSP) ?? 0) < soLuong) continue;
      const donGia = giaBanTaiThoiDiem(sp, khuyenMai, ngayDat);
      const thanhTien = soLuong * donGia;
      tienHang += thanhTien;
      dongHang.push({ maSP: sp.maSP, soLuong, donGia, thanhTien });
    }
    if (dongHang.length === 0) continue;

    // Trạng thái: đơn cũ hoàn thành/hủy, đơn gần đây đang xử lý.
    const laGanDay = soNgay > -NGAY_GAN_NHAT;
    let trangThai;
    if (laGanDay) {
      trangThai = rnd.chon(['Chờ xử lý', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy']);
    } else {
      trangThai = rnd.xacSuat(0.9) ? 'Hoàn thành' : 'Đã hủy';
    }

    // Sử dụng điểm cho một số đơn của khách đã tích lũy đủ.
    const diemHienCo = diemTheoKhach.get(khach.maKH) ?? 0;
    let diemSuDung = 0;
    if (trangThai !== 'Đã hủy' && diemHienCo >= 30 && rnd.xacSuat(0.3)) {
      diemSuDung = Math.min(Math.floor(diemHienCo / 2), 50);
    }
    const tienGiamDiem = diemSuDung * VND_PER_POINT_REDEEM;
    const tongTien = Math.max(0, tienHang - tienGiamDiem);

    const ketQua = await db.run(
      `INSERT INTO DONHANG (maKH, maNV, ngayDat, tongTien, tienHang, diemSuDung,
                            tienGiamDiem, hinhThuc, ghiChu, lyDoHuy, trangThai)
       VALUES (:maKH, :maNV, :ngayDat, :tongTien, :tienHang, :diemSuDung,
               :tienGiamDiem, :hinhThuc, :ghiChu, :lyDoHuy, :trangThai)`,
      {
        maKH: khach.maKH,
        maNV: nv.maNV,
        ngayDat,
        tongTien,
        tienHang,
        diemSuDung,
        tienGiamDiem,
        hinhThuc,
        ghiChu: hinhThuc === 'Giao hàng' ? 'Giao tại địa chỉ khách cung cấp' : null,
        lyDoHuy:
          trangThai === 'Đã hủy'
            ? rnd.chon(['Khách đổi ý', 'Hết nguyên liệu', 'Đặt trùng đơn'])
            : null,
        trangThai,
      }
    );
    const maDH = ketQua.lastInsertRowid;
    soDonHang += 1;

    for (const dong of dongHang) {
      await db.run(
        `INSERT INTO CHITIETDONHANG (maDH, maSP, soLuong, donGia, thanhTien)
         VALUES (:maDH, :maSP, :soLuong, :donGia, :thanhTien)`,
        { maDH, ...dong }
      );
      soChiTiet += 1;
      if (trangThai !== 'Đã hủy') {
        kho.set(dong.maSP, (kho.get(dong.maSP) ?? 0) - dong.soLuong);
      }
    }

    // Giao dịch điểm chỉ phát sinh với đơn không bị hủy.
    if (trangThai === 'Đã hủy') continue;

    if (diemSuDung > 0) {
      await db.run(
        `INSERT INTO LICHSUDIEM (maKH, maDH, soDiem, loaiGD, ghiChu, ngayGD)
         VALUES (:maKH, :maDH, :soDiem, N'Trừ', :ghiChu, :ngayGD)`,
        {
          maKH: khach.maKH,
          maDH,
          soDiem: diemSuDung,
          ghiChu: `Sử dụng điểm cho đơn hàng #${maDH}`,
          ngayGD: ngayDat,
        }
      );
      diemTheoKhach.set(khach.maKH, diemHienCo - diemSuDung);
      soGiaoDichDiem += 1;
    }

    if (trangThai === 'Hoàn thành') {
      const soDiem = Math.floor(tongTien / VND_PER_POINT);
      if (soDiem > 0) {
        await db.run(
          `INSERT INTO LICHSUDIEM (maKH, maDH, soDiem, loaiGD, ghiChu, ngayGD)
           VALUES (:maKH, :maDH, :soDiem, N'Cộng', :ghiChu, :ngayGD)`,
          {
            maKH: khach.maKH,
            maDH,
            soDiem,
            ghiChu: `Cộng điểm từ đơn hàng #${maDH}`,
            ngayGD: ngayDat,
          }
        );
        diemTheoKhach.set(khach.maKH, (diemTheoKhach.get(khach.maKH) ?? 0) + soDiem);
        soGiaoDichDiem += 1;
      }
    }
  }

  // Cập nhật điểm tích lũy hiện tại của từng khách hàng.
  for (const [maKH, diem] of diemTheoKhach) {
    await db.run('UPDATE KHACHHANG SET diemTichLuy = :diem WHERE maKH = :maKH', { diem, maKH });
  }

  return { soDonHang, soChiTiet, soGiaoDichDiem };
}

/** Ghi tồn kho cuối cùng vào bảng SANPHAM. */
async function capNhatTonKhoCuoi(kho) {
  for (const [maSP, soLuong] of kho) {
    await db.run('UPDATE SANPHAM SET soLuong = :soLuong WHERE maSP = :maSP', {
      soLuong: Math.max(0, soLuong),
      maSP,
    });
  }
}

/**
 * Đặt một vài sản phẩm về mức tồn kho thấp để minh hoạ
 * chức năng cảnh báo sắp hết hàng (CN2.7).
 */
async function datTonKhoCanhBao(sanPham) {
  const mucThap = [
    { viTri: 12, soLuong: 6 },
    { viTri: 22, soLuong: 14 },
    { viTri: 28, soLuong: 0 },
  ];
  for (const { viTri, soLuong } of mucThap) {
    const sp = sanPham[viTri - 1];
    if (!sp) continue;
    await db.run('UPDATE SANPHAM SET soLuong = :soLuong WHERE maSP = :maSP', {
      soLuong,
      maSP: sp.maSP,
    });
  }
  await db.run(
    `UPDATE SANPHAM SET trangThai = N'Hết hàng' WHERE soLuong = 0 AND trangThai = N'Đang bán'`
  );
}
