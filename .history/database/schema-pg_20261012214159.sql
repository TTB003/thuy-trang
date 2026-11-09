-- =============================================================================
-- HỆ THỐNG THÔNG TIN DOANH NGHIỆP BÁN COFFEE (COFFEE CRM)
-- Script tạo cơ sở dữ liệu — BẢN POSTGRESQL
-- -----------------------------------------------------------------------------
-- Nguồn: ERD-Co-Trang-29-09-26.drawio (17 bảng) + Mo-ta-chuc-nang-he-thong-co_Trang.docx
-- Cách dùng: mở pgAdmin -> chọn database DAS -> Query Tool -> dán toàn bộ file
--            này rồi bấm Execute (F5).
-- Cơ sở dữ liệu: DAS | Người dùng: postgres
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hàm bỏ dấu tiếng Việt, phục vụ tìm kiếm không phân biệt dấu (CN2.4, CN5.4...)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION unaccent_vn(txt text) RETURNS text AS $$
  SELECT translate(lower(coalesce(txt, '')),
         'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
         'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiioooooooooooooooooouuuuuuuuuuuyyyyyd')
$$ LANGUAGE SQL IMMUTABLE;

-- =============================================================================
-- XÓA CÁC BẢNG CŨ (chạy lại script an toàn)
-- =============================================================================
DROP TABLE IF EXISTS CHITIETTRALOI CASCADE;
DROP TABLE IF EXISTS PHIEUTRALOI CASCADE;
DROP TABLE IF EXISTS CAUHOIKHAOSAT CASCADE;
DROP TABLE IF EXISTS GUIKHAOSAT CASCADE;
DROP TABLE IF EXISTS KHAOSAT CASCADE;
DROP TABLE IF EXISTS PHANHOI CASCADE;
DROP TABLE IF EXISTS CTKM CASCADE;
DROP TABLE IF EXISTS KHUYENMAI CASCADE;
DROP TABLE IF EXISTS LICHSUDIEM CASCADE;
DROP TABLE IF EXISTS CHITIETDONHANG CASCADE;
DROP TABLE IF EXISTS DONHANG CASCADE;
DROP TABLE IF EXISTS CTPNH CASCADE;
DROP TABLE IF EXISTS PHIEUNGUONHANG CASCADE;
DROP TABLE IF EXISTS PHIENDANGNHAP CASCADE;
DROP TABLE IF EXISTS TAIKHOAN CASCADE;
DROP TABLE IF EXISTS KHACHHANG CASCADE;
DROP TABLE IF EXISTS NHANVIEN CASCADE;
DROP TABLE IF EXISTS SANPHAM CASCADE;
DROP TABLE IF EXISTS NHACUNGCAP CASCADE;
DROP TABLE IF EXISTS LOAISANPHAM CASCADE;
DROP TABLE IF EXISTS NHATKYSAOLUU CASCADE;

-- -----------------------------------------------------------------------------
-- 1. LOAISANPHAM - Loại sản phẩm
-- -----------------------------------------------------------------------------
CREATE TABLE LOAISANPHAM (
  maLoai   SERIAL       PRIMARY KEY,
  tenLoai  VARCHAR(100) NOT NULL UNIQUE,
  moTa     VARCHAR(255) NULL
);

-- -----------------------------------------------------------------------------
-- 2. NHACUNGCAP - Nhà cung cấp
-- -----------------------------------------------------------------------------
CREATE TABLE NHACUNGCAP (
  maNCC     SERIAL       PRIMARY KEY,
  tenNCC    VARCHAR(150) NOT NULL,
  sdt       VARCHAR(15)  NULL,
  diaChi    VARCHAR(255) NULL,
  email     VARCHAR(100) NULL,
  trangThai VARCHAR(30)  NOT NULL DEFAULT N'Đang hợp tác'
);

-- -----------------------------------------------------------------------------
-- 3. NHANVIEN - Nhân viên
-- -----------------------------------------------------------------------------
CREATE TABLE NHANVIEN (
  maNV      SERIAL       PRIMARY KEY,
  hoTen     VARCHAR(100) NOT NULL,
  email     VARCHAR(100) NOT NULL UNIQUE,
  chucVu    VARCHAR(50)  NOT NULL,
  sdt       VARCHAR(15)  NULL,
  ngayVao   DATE         NULL,
  trangThai VARCHAR(30)  NOT NULL DEFAULT N'Đang làm việc'
);

-- -----------------------------------------------------------------------------
-- 4. KHACHHANG - Khách hàng
-- Ghi chú: bổ sung ngaySinh, gioiTinh, soThich để phục vụ báo cáo
--          "tỷ lệ độ tuổi, sở thích" theo yêu cầu mục 4.1 của đồ án.
-- -----------------------------------------------------------------------------
CREATE TABLE KHACHHANG (
  maKH        SERIAL       PRIMARY KEY,
  hoTen       VARCHAR(100) NOT NULL,
  sdt         VARCHAR(15)  NOT NULL UNIQUE,
  email       VARCHAR(100) NULL,
  ngaySinh    DATE         NULL,
  gioiTinh    VARCHAR(10)  NULL,
  diaChi      VARCHAR(255) NULL,
  soThich     VARCHAR(150) NULL,
  diemTichLuy INTEGER      NOT NULL DEFAULT 0,
  trangThai   VARCHAR(30)  NOT NULL DEFAULT N'Hoạt động',
  ngayDangKy  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_khachhang_diem CHECK (diemTichLuy >= 0)
);

-- -----------------------------------------------------------------------------
-- 5. TAIKHOAN - Tài khoản đăng nhập & phân quyền (CN4.5)
-- -----------------------------------------------------------------------------
CREATE TABLE TAIKHOAN (
  maTK             SERIAL       PRIMARY KEY,
  tenDangNhap      VARCHAR(100) NOT NULL UNIQUE,
  matKhau          VARCHAR(255) NOT NULL,
  vaiTro           VARCHAR(30)  NOT NULL,
  maNV             INTEGER      NULL REFERENCES NHANVIEN(maNV) ON DELETE CASCADE,
  maKH             INTEGER      NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  trangThai        VARCHAR(30)  NOT NULL DEFAULT N'Hoạt động',
  ngayTao          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lanDangNhapCuoi  TIMESTAMP    NULL,
  CONSTRAINT chk_taikhoan_vaitro
    CHECK (vaiTro IN (N'Admin', N'Quản lý', N'Nhân viên', N'Khách hàng'))
);

-- -----------------------------------------------------------------------------
-- 6. PHIENDANGNHAP - Phiên đăng nhập
-- -----------------------------------------------------------------------------
CREATE TABLE PHIENDANGNHAP (
  token    VARCHAR(64) PRIMARY KEY,
  maTK     INTEGER     NOT NULL REFERENCES TAIKHOAN(maTK) ON DELETE CASCADE,
  ngayTao  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hetHan   TIMESTAMP   NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. SANPHAM - Sản phẩm
-- -----------------------------------------------------------------------------
CREATE TABLE SANPHAM (
  maSP      SERIAL        PRIMARY KEY,
  maLoai    INTEGER       NOT NULL REFERENCES LOAISANPHAM(maLoai),
  tenSP     VARCHAR(150)  NOT NULL,
  moTa      VARCHAR(255)  NULL,
  gia       NUMERIC(18,2) NOT NULL,
  soLuong   INTEGER       NOT NULL DEFAULT 0,
  hinhAnh   VARCHAR(255)  NULL,
  trangThai VARCHAR(30)   NOT NULL DEFAULT N'Đang bán',
  CONSTRAINT chk_sanpham_gia     CHECK (gia >= 0),
  CONSTRAINT chk_sanpham_soluong CHECK (soLuong >= 0),
  CONSTRAINT chk_sanpham_trangthai
    CHECK (trangThai IN (N'Đang bán', N'Ngừng bán', N'Hết hàng'))
);

-- -----------------------------------------------------------------------------
-- 8. KHUYENMAI - Chương trình khuyến mãi
-- -----------------------------------------------------------------------------
CREATE TABLE KHUYENMAI (
  maKM        SERIAL        PRIMARY KEY,
  tenKM       VARCHAR(150)  NOT NULL,
  moTa        VARCHAR(255)  NULL,
  giaTriGiam  NUMERIC(18,2) NOT NULL,
  ngayBatDau  DATE          NOT NULL,
  ngayKetThuc DATE          NOT NULL,
  trangThai   VARCHAR(30)   NOT NULL DEFAULT N'Đang diễn ra',
  CONSTRAINT chk_khuyenmai_giatri CHECK (giaTriGiam >= 0)
);

-- -----------------------------------------------------------------------------
-- 9. CTKM - Chi tiết khuyến mãi
-- -----------------------------------------------------------------------------
CREATE TABLE CTKM (
  maKM INTEGER NOT NULL REFERENCES KHUYENMAI(maKM) ON DELETE CASCADE,
  maSP INTEGER NOT NULL REFERENCES SANPHAM(maSP)   ON DELETE CASCADE,
  PRIMARY KEY (maKM, maSP)
);
