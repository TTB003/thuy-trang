-- =============================================================================
-- HỆ THỐNG THÔNG TIN DOANH NGHIỆP BÁN COFFEE (COFFEE CRM)
-- Script tạo cơ sở dữ liệu
-- -----------------------------------------------------------------------------
-- Nguồn: ERD-Co-Trang-29-09-26.drawio (17 bảng) + Mo-ta-chuc-nang-he-thong-co_Trang.docx
-- Ghi chú: Đây là bản SQLite (chạy trực tiếp, không cần cài đặt máy chủ).
--          Mỗi cột có kèm comment kiểu tương ứng của SQL Server.
-- CHARSET: UTF-8
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. LOAISANPHAM - Loại sản phẩm
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS LOAISANPHAM;
CREATE TABLE LOAISANPHAM (
  maLoai   INT           PRIMARY KEY AUTOINCREMENT,  -- SQL Server: INT IDENTITY(1,1)
  tenLoai  NVARCHAR(100) NOT NULL UNIQUE,            -- SQL Server: NVARCHAR(100)
  moTa     NVARCHAR(255) NULL
);

-- -----------------------------------------------------------------------------
-- 2. NHACUNGCAP - Nhà cung cấp
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS NHACUNGCAP;
CREATE TABLE NHACUNGCAP (
  maNCC    INT           PRIMARY KEY AUTOINCREMENT,
  tenNCC   NVARCHAR(150) NOT NULL,
  sdt      VARCHAR(15)   NULL,
  diaChi   NVARCHAR(255) NULL,
  email    VARCHAR(100)  NULL,
  trangThai NVARCHAR(30) NOT NULL DEFAULT N'Đang hợp tác'
);

-- -----------------------------------------------------------------------------
-- 3. NHANVIEN - Nhân viên
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS NHANVIEN;
CREATE TABLE NHANVIEN (
  maNV     INT           PRIMARY KEY AUTOINCREMENT,
  hoTen    NVARCHAR(100) NOT NULL,
  email    VARCHAR(100)  NOT NULL UNIQUE,
  chucVu   NVARCHAR(50)  NOT NULL,          -- Quản lý | Nhân viên bán hàng | Nhân viên kho | Nhân viên CSKH
  sdt      VARCHAR(15)   NULL,
  ngayVao  DATE          NULL,
  trangThai NVARCHAR(30) NOT NULL DEFAULT N'Đang làm việc'
);

-- -----------------------------------------------------------------------------
-- 4. KHACHHANG - Khách hàng
-- Ghi chú: bổ sung ngaySinh, gioiTinh, soThich để phục vụ báo cáo
--          "tỷ lệ độ tuổi, sở thích" theo yêu cầu mục 4.1 - đồ án.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS KHACHHANG;
CREATE TABLE KHACHHANG (
  maKH       INT           PRIMARY KEY AUTOINCREMENT,
  hoTen      NVARCHAR(100) NOT NULL,
  sdt        VARCHAR(15)   NOT NULL UNIQUE,
  email      VARCHAR(100)  NULL,
  ngaySinh   DATE          NULL,
  gioiTinh   NVARCHAR(10)  NULL,                -- Nam | Nữ | Khác
  diaChi     NVARCHAR(255) NULL,
  soThich    NVARCHAR(150) NULL,
  diemTichLuy INT          NOT NULL DEFAULT 0,
  trangThai  NVARCHAR(30)  NOT NULL DEFAULT N'Hoạt động',
  ngayDangKy DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (diemTichLuy >= 0)
);

-- -----------------------------------------------------------------------------
-- 5. TAIKHOAN - Tài khoản đăng nhập & phân quyền (CN4.5)
-- Ghi chú: ERD chưa có cột mật khẩu -> bổ sung bảng TAIKHOAN khi triển khai.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS TAIKHOAN;
CREATE TABLE TAIKHOAN (
  maTK        INT           PRIMARY KEY AUTOINCREMENT,
  tenDangNhap VARCHAR(100)  NOT NULL UNIQUE,
  matKhau     VARCHAR(255)  NOT NULL,           -- lưu dạng scrypt: salt:hash
  vaiTro      NVARCHAR(30)  NOT NULL,           -- Admin | Quản lý | Nhân viên | Khách hàng
  maNV        INT           NULL,
  maKH        INT           NULL,
  trangThai   NVARCHAR(30)  NOT NULL DEFAULT N'Hoạt động',
  ngayTao     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lanDangNhapCuoi DATETIME  NULL,
  FOREIGN KEY (maNV) REFERENCES NHANVIEN(maNV) ON DELETE CASCADE,
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  CHECK (vaiTro IN (N'Admin', N'Quản lý', N'Nhân viên', N'Khách hàng'))
);

-- -----------------------------------------------------------------------------
-- 6. PHIENDANGNHAP - Phiên đăng nhập
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS PHIENDANGNHAP;
CREATE TABLE PHIENDANGNHAP (
  token     VARCHAR(64)  PRIMARY KEY,
  maTK      INT          NOT NULL,
  ngayTao   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hetHan    DATETIME     NOT NULL,
  FOREIGN KEY (maTK) REFERENCES TAIKHOAN(maTK) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 7. SANPHAM - Sản phẩm
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS SANPHAM;
CREATE TABLE SANPHAM (
  maSP      INT           PRIMARY KEY AUTOINCREMENT,
  maLoai    INT           NOT NULL,
  tenSP     NVARCHAR(150) NOT NULL,
  moTa      NVARCHAR(255) NULL,
  gia       DECIMAL(18,2) NOT NULL,
  soLuong   INT           NOT NULL DEFAULT 0,
  hinhAnh   VARCHAR(255)  NULL,
  trangThai NVARCHAR(30)  NOT NULL DEFAULT N'Đang bán',  -- Đang bán | Ngừng bán | Hết hàng
  FOREIGN KEY (maLoai) REFERENCES LOAISANPHAM(maLoai),
  CHECK (gia >= 0),
  CHECK (soLuong >= 0),
  CHECK (trangThai IN (N'Đang bán', N'Ngừng bán', N'Hết hàng'))
);

-- -----------------------------------------------------------------------------
-- 8. KHUYENMAI - Chương trình khuyến mãi
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS KHUYENMAI;
CREATE TABLE KHUYENMAI (
  maKM         INT           PRIMARY KEY AUTOINCREMENT,
  tenKM        NVARCHAR(150) NOT NULL,
  moTa         NVARCHAR(255) NULL,
  giaTriGiam   DECIMAL(18,2) NOT NULL,   -- số tiền giảm trên mỗi sản phẩm (VND)
  ngayBatDau   DATE          NOT NULL,
  ngayKetThuc  DATE          NOT NULL,
  trangThai    NVARCHAR(30)  NOT NULL DEFAULT N'Đang diễn ra', -- Đang diễn ra | Đã kết thúc | Tạm dừng
  CHECK (giaTriGiam >= 0)
);

-- -----------------------------------------------------------------------------
-- 9. CTKM - Chi tiết khuyến mãi (áp dụng khuyến mãi cho sản phẩm)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS CTKM;
CREATE TABLE CTKM (
  maKM  INT NOT NULL,
  maSP  INT NOT NULL,
  PRIMARY KEY (maKM, maSP),
  FOREIGN KEY (maKM) REFERENCES KHUYENMAI(maKM) ON DELETE CASCADE,
  FOREIGN KEY (maSP) REFERENCES SANPHAM(maSP)   ON DELETE CASCADE
);
