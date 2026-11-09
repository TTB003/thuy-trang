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
-- -----------------------------------------------------------------------------
-- 10. PHIEUNGUONHANG - Phiếu nhập hàng
-- -----------------------------------------------------------------------------
CREATE TABLE PHIEUNGUONHANG (
  maPNH     SERIAL        PRIMARY KEY,
  maNCC     INTEGER       NOT NULL REFERENCES NHACUNGCAP(maNCC),
  maNV      INTEGER       NOT NULL REFERENCES NHANVIEN(maNV),
  ngayNhap  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tongTien  NUMERIC(18,2) NOT NULL DEFAULT 0,
  lyDoHuy   VARCHAR(255)  NULL,
  trangThai VARCHAR(30)   NOT NULL DEFAULT N'Hoàn thành',
  CONSTRAINT chk_pnh_trangthai
    CHECK (trangThai IN (N'Chờ duyệt', N'Hoàn thành', N'Đã hủy'))
);

-- -----------------------------------------------------------------------------
-- 11. CTPNH - Chi tiết phiếu nhập hàng
-- -----------------------------------------------------------------------------
CREATE TABLE CTPNH (
  maPNH     INTEGER       NOT NULL REFERENCES PHIEUNGUONHANG(maPNH) ON DELETE CASCADE,
  maSP      INTEGER       NOT NULL REFERENCES SANPHAM(maSP),
  soLuong   INTEGER       NOT NULL,
  donGia    NUMERIC(18,2) NOT NULL,
  thanhTien NUMERIC(18,2) NOT NULL,
  PRIMARY KEY (maPNH, maSP),
  CONSTRAINT chk_ctpnh_soluong CHECK (soLuong > 0)
);

-- -----------------------------------------------------------------------------
-- 12. DONHANG - Đơn hàng
-- -----------------------------------------------------------------------------
CREATE TABLE DONHANG (
  maDH         SERIAL        PRIMARY KEY,
  maKH         INTEGER       NOT NULL REFERENCES KHACHHANG(maKH),
  maNV         INTEGER       NULL REFERENCES NHANVIEN(maNV),
  ngayDat      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tongTien     NUMERIC(18,2) NOT NULL DEFAULT 0,
  tienHang     NUMERIC(18,2) NOT NULL DEFAULT 0,
  diemSuDung   INTEGER       NOT NULL DEFAULT 0,
  tienGiamDiem NUMERIC(18,2) NOT NULL DEFAULT 0,
  hinhThuc     VARCHAR(30)   NOT NULL DEFAULT N'Tại quán',
  ghiChu       VARCHAR(255)  NULL,
  lyDoHuy      VARCHAR(255)  NULL,
  trangThai    VARCHAR(30)   NOT NULL DEFAULT N'Chờ xử lý',
  CONSTRAINT chk_donhang_trangthai
    CHECK (trangThai IN (N'Chờ xử lý', N'Đã xác nhận', N'Đang giao', N'Hoàn thành', N'Đã hủy')),
  CONSTRAINT chk_donhang_diem CHECK (diemSuDung >= 0)
);

-- -----------------------------------------------------------------------------
-- 13. CHITIETDONHANG - Chi tiết đơn hàng
-- -----------------------------------------------------------------------------
CREATE TABLE CHITIETDONHANG (
  maDH      INTEGER       NOT NULL REFERENCES DONHANG(maDH) ON DELETE CASCADE,
  maSP      INTEGER       NOT NULL REFERENCES SANPHAM(maSP),
  soLuong   INTEGER       NOT NULL,
  donGia    NUMERIC(18,2) NOT NULL,
  thanhTien NUMERIC(18,2) NOT NULL,
  PRIMARY KEY (maDH, maSP),
  CONSTRAINT chk_ctdh_soluong CHECK (soLuong > 0)
);

-- -----------------------------------------------------------------------------
-- 14. LICHSUDIEM - Lịch sử tích lũy điểm khách hàng
-- -----------------------------------------------------------------------------
CREATE TABLE LICHSUDIEM (
  maLS    SERIAL       PRIMARY KEY,
  maKH    INTEGER      NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  maDH    INTEGER      NULL REFERENCES DONHANG(maDH) ON DELETE SET NULL,
  soDiem  INTEGER      NOT NULL,
  loaiGD  VARCHAR(30)  NOT NULL,
  ghiChu  VARCHAR(255) NULL,
  ngayGD  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 15. PHANHOI - Phản hồi / đánh giá của khách hàng
-- -----------------------------------------------------------------------------
CREATE TABLE PHANHOI (
  maPH       SERIAL        PRIMARY KEY,
  maKH       INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  maNV       INTEGER       NULL REFERENCES NHANVIEN(maNV),
  maSP       INTEGER       NULL REFERENCES SANPHAM(maSP),
  noiDung    VARCHAR(1000) NOT NULL,
  danhGia    INTEGER       NOT NULL,
  phanHoiLai VARCHAR(1000) NULL,
  trangThai  VARCHAR(30)   NOT NULL DEFAULT N'Chờ xử lý',
  ngayGui    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngayXuLy   TIMESTAMP     NULL,
  CONSTRAINT chk_phanhoi_danhgia CHECK (danhGia BETWEEN 1 AND 5)
);

-- -----------------------------------------------------------------------------
-- 16. KHAOSAT - Khảo sát (thăm dò khách hàng)
-- -----------------------------------------------------------------------------
CREATE TABLE KHAOSAT (
  maKS      SERIAL       PRIMARY KEY,
  maNV      INTEGER      NOT NULL REFERENCES NHANVIEN(maNV),
  tieuDe    VARCHAR(200) NOT NULL,
  moTa      VARCHAR(500) NULL,
  loaiKS    VARCHAR(50)  NOT NULL,
  doiTuong  VARCHAR(30)  NOT NULL DEFAULT N'Tất cả khách hàng',
  ngayTao   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hanChot   DATE         NULL,
  trangThai VARCHAR(30)  NOT NULL DEFAULT N'Đang mở'
);

-- -----------------------------------------------------------------------------
-- 17. GUIKHAOSAT - Gửi khảo sát đến tài khoản khách hàng
-- Ghi chú: bổ sung để thực hiện chức năng "Tạo bảng khảo sát và gửi đến
--          tài khoản khách hàng" (mục 4.1 của đồ án).
-- -----------------------------------------------------------------------------
CREATE TABLE GUIKHAOSAT (
  maKS    INTEGER   NOT NULL REFERENCES KHAOSAT(maKS) ON DELETE CASCADE,
  maKH    INTEGER   NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  ngayGui TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  daXem   INTEGER   NOT NULL DEFAULT 0,
  PRIMARY KEY (maKS, maKH)
);

-- -----------------------------------------------------------------------------
-- 18. CAUHOIKHAOSAT - Câu hỏi của khảo sát
-- -----------------------------------------------------------------------------
CREATE TABLE CAUHOIKHAOSAT (
  maCauHoi  SERIAL       PRIMARY KEY,
  maKS      INTEGER      NOT NULL REFERENCES KHAOSAT(maKS) ON DELETE CASCADE,
  noiDung   VARCHAR(500) NOT NULL,
  loaiCauHoi VARCHAR(30) NOT NULL DEFAULT N'Trả lời ngắn',
  luaChon   VARCHAR(500) NULL,
  batBuoc   INTEGER      NOT NULL DEFAULT 1,
  thuTu     INTEGER      NOT NULL DEFAULT 1
);

-- -----------------------------------------------------------------------------
-- 19. PHIEUTRALOI - Phiếu trả lời khảo sát
-- -----------------------------------------------------------------------------
CREATE TABLE PHIEUTRALOI (
  maPhieu    SERIAL    PRIMARY KEY,
  maKS       INTEGER   NOT NULL REFERENCES KHAOSAT(maKS) ON DELETE CASCADE,
  maKH       INTEGER   NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  ngayTraLoi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_phieutraloi UNIQUE (maKS, maKH)
);

-- -----------------------------------------------------------------------------
-- 20. CHITIETTRALOI - Chi tiết câu trả lời
-- -----------------------------------------------------------------------------
CREATE TABLE CHITIETTRALOI (
  maPhieu       INTEGER       NOT NULL REFERENCES PHIEUTRALOI(maPhieu) ON DELETE CASCADE,
  maCauHoi      INTEGER       NOT NULL REFERENCES CAUHOIKHAOSAT(maCauHoi) ON DELETE CASCADE,
  noiDungTraLoi VARCHAR(1000) NOT NULL,
  PRIMARY KEY (maPhieu, maCauHoi)
);

-- -----------------------------------------------------------------------------
-- 21. NHATKYSAOLUU - Nhật ký sao lưu cơ sở dữ liệu (yêu cầu mục II.1)
-- -----------------------------------------------------------------------------
CREATE TABLE NHATKYSAOLUU (
  maNK      SERIAL       PRIMARY KEY,
  tenFile   VARCHAR(100) NOT NULL,
  ghiChu    VARCHAR(255) NULL,
  kichThuoc INTEGER      NOT NULL DEFAULT 0,
  thoiDiem  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CHỈ MỤC (INDEX) phục vụ tìm kiếm / lọc / báo cáo
-- =============================================================================
CREATE INDEX idx_sanpham_loai      ON SANPHAM(maLoai);
CREATE INDEX idx_sanpham_trangthai ON SANPHAM(trangThai);
CREATE INDEX idx_donhang_kh        ON DONHANG(maKH);
CREATE INDEX idx_donhang_ngay      ON DONHANG(ngayDat);
CREATE INDEX idx_donhang_trangthai ON DONHANG(trangThai);
CREATE INDEX idx_ctdh_sp           ON CHITIETDONHANG(maSP);
CREATE INDEX idx_pnh_ngay          ON PHIEUNGUONHANG(ngayNhap);
CREATE INDEX idx_khachhang_sdt     ON KHACHHANG(sdt);
CREATE INDEX idx_phanhoi_kh        ON PHANHOI(maKH);
CREATE INDEX idx_lichsudiem_kh     ON LICHSUDIEM(maKH);
CREATE INDEX idx_phieutraloi_ks    ON PHIEUTRALOI(maKS);

-- =============================================================================
-- VIEW hỗ trợ báo cáo
-- =============================================================================
CREATE OR REPLACE VIEW V_DOANHTHU_NGAY AS
SELECT CAST(ngayDat AS DATE) AS ngay,
       COUNT(*)              AS soDon,
       SUM(tongTien)         AS doanhThu
FROM DONHANG
WHERE trangThai = N'Hoàn thành'
GROUP BY CAST(ngayDat AS DATE);

CREATE OR REPLACE VIEW V_SANPHAM_BANCHAY AS
SELECT sp.maSP, sp.tenSP, l.tenLoai,
       SUM(ct.soLuong)   AS tongSoLuong,
       SUM(ct.thanhTien) AS tongDoanhThu
FROM CHITIETDONHANG ct
JOIN DONHANG d ON d.maDH = ct.maDH AND d.trangThai = N'Hoàn thành'
JOIN SANPHAM sp ON sp.maSP = ct.maSP
JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
GROUP BY sp.maSP, sp.tenSP, l.tenLoai;

CREATE OR REPLACE VIEW V_TONKHO AS
SELECT sp.maSP, sp.tenSP, l.tenLoai, sp.gia, sp.soLuong,
       (sp.soLuong * sp.gia) AS giaTriTon,
       sp.trangThai
FROM SANPHAM sp
JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai;

-- =============================================================================
-- KẾT THÚC SCRIPT
-- =============================================================================
-- =============================================================================
-- 22. PHIEUGIAMGIA - Phiếu giảm giá của khách hàng (ưu đãi sinh nhật)
--     Sinh nhật: giảm 50% cho 1 ly, hiệu lực 30 ngày kể từ ngày sinh nhật.
-- =============================================================================
DROP TABLE IF EXISTS THONGBAO;
DROP TABLE IF EXISTS PHIEUGIAMGIA;
CREATE TABLE PHIEUGIAMGIA (
  maPG             SERIAL        PRIMARY KEY,
  maKH             INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  maCode           VARCHAR(40)   NOT NULL UNIQUE,
  tieuDe           VARCHAR(150)  NOT NULL,
  moTa             VARCHAR(255)  NULL,
  phanTramGiam     INTEGER       NOT NULL,
  giamToiDa        NUMERIC(18,2) NULL,
  soLanSuDungToiDa INTEGER       NOT NULL DEFAULT 1,
  soLanDaSuDung    INTEGER       NOT NULL DEFAULT 0,
  loai             VARCHAR(40)   NOT NULL DEFAULT N'Khác',
  trangThai        VARCHAR(30)   NOT NULL DEFAULT N'Chưa dùng',
  ngayTao          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngayHetHan       TIMESTAMP     NULL,
  CONSTRAINT chk_phieugiamgia_phantram CHECK (phanTramGiam BETWEEN 1 AND 100),
  CONSTRAINT chk_phieugiamgia_solan CHECK (soLanDaSuDung >= 0 AND soLanSuDungToiDa >= 1)
);

CREATE INDEX idx_phieugiamgia_kh ON PHIEUGIAMGIA (maKH, trangThai);

-- =============================================================================
-- 23. THONGBAO - Thông báo gửi tới khách hàng (chuông thông báo cổng khách)
-- =============================================================================
CREATE TABLE THONGBAO (
  maTB     SERIAL        PRIMARY KEY,
  maKH     INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  tieuDe   VARCHAR(150)  NOT NULL,
  noiDung  VARCHAR(500)  NULL,
  loai     VARCHAR(40)   NOT NULL DEFAULT N'Thông tin',
  maPG     INTEGER       NULL REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL,
  daDoc    INTEGER       NOT NULL DEFAULT 0,
  ngayTao  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao);
