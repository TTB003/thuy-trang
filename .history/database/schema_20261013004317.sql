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
-- -----------------------------------------------------------------------------
-- 10. PHIEUNGUONHANG - Phiếu nhập hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS PHIEUNGUONHANG;
CREATE TABLE PHIEUNGUONHANG (
  maPNH     INT           PRIMARY KEY AUTOINCREMENT,
  maNCC     INT           NOT NULL,
  maNV      INT           NOT NULL,
  ngayNhap  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tongTien  DECIMAL(18,2) NOT NULL DEFAULT 0,
  lyDoHuy   NVARCHAR(255) NULL,
  trangThai NVARCHAR(30)  NOT NULL DEFAULT N'Hoàn thành', -- Chờ duyệt | Hoàn thành | Đã hủy
  FOREIGN KEY (maNCC) REFERENCES NHACUNGCAP(maNCC),
  FOREIGN KEY (maNV)  REFERENCES NHANVIEN(maNV),
  CHECK (trangThai IN (N'Chờ duyệt', N'Hoàn thành', N'Đã hủy'))
);

-- -----------------------------------------------------------------------------
-- 11. CTPNH - Chi tiết phiếu nhập hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS CTPNH;
CREATE TABLE CTPNH (
  maPNH     INT           NOT NULL,
  maSP      INT           NOT NULL,
  soLuong   INT           NOT NULL,
  donGia    DECIMAL(18,2) NOT NULL,
  thanhTien DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (maPNH, maSP),
  FOREIGN KEY (maPNH) REFERENCES PHIEUNGUONHANG(maPNH) ON DELETE CASCADE,
  FOREIGN KEY (maSP)  REFERENCES SANPHAM(maSP),
  CHECK (soLuong > 0)
);

-- -----------------------------------------------------------------------------
-- 12. DONHANG - Đơn hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS DONHANG;
CREATE TABLE DONHANG (
  maDH        INT           PRIMARY KEY AUTOINCREMENT,
  maKH        INT           NOT NULL,
  maNV        INT           NULL,       -- nhân viên lập đơn (NULL nếu khách tự đặt online)
  ngayDat     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tongTien    DECIMAL(18,2) NOT NULL DEFAULT 0,  -- tổng sau khi trừ điểm
  tienHang    DECIMAL(18,2) NOT NULL DEFAULT 0,  -- tổng tiền hàng trước giảm giá
  diemSuDung  INT           NOT NULL DEFAULT 0,
  tienGiamDiem DECIMAL(18,2) NOT NULL DEFAULT 0,
  hinhThuc    NVARCHAR(30)  NOT NULL DEFAULT N'Tại quán', -- Tại quán | Giao hàng
  ghiChu      NVARCHAR(255) NULL,
  lyDoHuy     NVARCHAR(255) NULL,
  trangThai   NVARCHAR(30)  NOT NULL DEFAULT N'Chờ xử lý',
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH),
  FOREIGN KEY (maNV) REFERENCES NHANVIEN(maNV),
  CHECK (trangThai IN (N'Chờ xử lý', N'Đã xác nhận', N'Đang giao', N'Hoàn thành', N'Đã hủy')),
  CHECK (diemSuDung >= 0)
);

-- -----------------------------------------------------------------------------
-- 13. CHITIETDONHANG - Chi tiết đơn hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS CHITIETDONHANG;
CREATE TABLE CHITIETDONHANG (
  maDH      INT           NOT NULL,
  maSP      INT           NOT NULL,
  soLuong   INT           NOT NULL,
  donGia    DECIMAL(18,2) NOT NULL,
  thanhTien DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (maDH, maSP),
  FOREIGN KEY (maDH) REFERENCES DONHANG(maDH) ON DELETE CASCADE,
  FOREIGN KEY (maSP) REFERENCES SANPHAM(maSP),
  CHECK (soLuong > 0)
);

-- -----------------------------------------------------------------------------
-- 14. LICHSUDIEM - Lịch sử tích lũy điểm khách hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS LICHSUDIEM;
CREATE TABLE LICHSUDIEM (
  maLS     INT           PRIMARY KEY AUTOINCREMENT,
  maKH     INT           NOT NULL,
  maDH     INT           NULL,
  soDiem   INT           NOT NULL,   -- số điểm cộng/trừ (luôn dương), loaiGD quyết định dấu
  loaiGD   NVARCHAR(30)  NOT NULL,   -- Cộng | Trừ | Hoàn | Thu hồi
  ghiChu   NVARCHAR(255) NULL,
  ngayGD   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  FOREIGN KEY (maDH) REFERENCES DONHANG(maDH) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 15. PHANHOI - Phản hồi / đánh giá của khách hàng
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS PHANHOI;
CREATE TABLE PHANHOI (
  maPH      INT           PRIMARY KEY AUTOINCREMENT,
  maKH      INT           NOT NULL,
  maNV      INT           NULL,       -- nhân viên tiếp nhận & xử lý (CN10.2)
  maSP      INT           NULL,       -- phản hồi cho sản phẩm nào (nếu có)
  noiDung   NVARCHAR(1000) NOT NULL,
  danhGia   INT           NOT NULL,   -- 1..5 sao
  phanHoiLai NVARCHAR(1000) NULL,     -- nội dung nhân viên trả lời khách
  trangThai NVARCHAR(30)  NOT NULL DEFAULT N'Chờ xử lý', -- Chờ xử lý | Đã xử lý
  ngayGui   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngayXuLy  DATETIME      NULL,
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  FOREIGN KEY (maNV) REFERENCES NHANVIEN(maNV),
  FOREIGN KEY (maSP) REFERENCES SANPHAM(maSP),
  CHECK (danhGia BETWEEN 1 AND 5)
);

-- -----------------------------------------------------------------------------
-- 16. KHAOSAT - Khảo sát (thăm dò khách hàng)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS KHAOSAT;
CREATE TABLE KHAOSAT (
  maKS       INT           PRIMARY KEY AUTOINCREMENT,
  maNV       INT           NOT NULL,
  tieuDe     NVARCHAR(200) NOT NULL,
  moTa       NVARCHAR(500) NULL,
  loaiKS     NVARCHAR(50)  NOT NULL,   -- Sản phẩm mới | Mức độ hài lòng | Khác
  doiTuong   NVARCHAR(30)  NOT NULL DEFAULT N'Tất cả khách hàng',
  ngayTao    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hanChot    DATE          NULL,
  trangThai  NVARCHAR(30)  NOT NULL DEFAULT N'Đang mở', -- Đang mở | Đã đóng
  FOREIGN KEY (maNV) REFERENCES NHANVIEN(maNV)
);

-- -----------------------------------------------------------------------------
-- 17. GUIKHAOSAT - Gửi khảo sát đến tài khoản khách hàng
-- Ghi chú: bổ sung để thực hiện chức năng "Tạo bảng khảo sát và gửi đến
--          tài khoản khách hàng" (mục 4.1 - đồ án).
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS GUIKHAOSAT;
CREATE TABLE GUIKHAOSAT (
  maKS       INT          NOT NULL,
  maKH       INT          NOT NULL,
  ngayGui    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  daXem      INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (maKS, maKH),
  FOREIGN KEY (maKS) REFERENCES KHAOSAT(maKS) ON DELETE CASCADE,
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 18. CAUHOIKHAOSAT - Câu hỏi của khảo sát
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS CAUHOIKHAOSAT;
CREATE TABLE CAUHOIKHAOSAT (
  maCauHoi INT           PRIMARY KEY AUTOINCREMENT,
  maKS     INT           NOT NULL,
  noiDung  NVARCHAR(500) NOT NULL,
  loaiCauHoi NVARCHAR(30) NOT NULL DEFAULT N'Trả lời ngắn', -- Trả lời ngắn | Một lựa chọn | Nhiều lựa chọn | Thang điểm
  luaChon  NVARCHAR(500) NULL,     -- danh sách lựa chọn, phân tách bởi dấu |
  batBuoc  INT           NOT NULL DEFAULT 1,
  thuTu    INT           NOT NULL DEFAULT 1,
  FOREIGN KEY (maKS) REFERENCES KHAOSAT(maKS) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 19. PHIEUTRALOI - Phiếu trả lời khảo sát
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS PHIEUTRALOI;
CREATE TABLE PHIEUTRALOI (
  maPhieu    INT      PRIMARY KEY AUTOINCREMENT,
  maKS       INT      NOT NULL,
  maKH       INT      NOT NULL,
  ngayTraLoi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (maKS) REFERENCES KHAOSAT(maKS) ON DELETE CASCADE,
  FOREIGN KEY (maKH) REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  UNIQUE (maKS, maKH)   -- mỗi khách chỉ trả lời 1 lần cho mỗi khảo sát
);

-- -----------------------------------------------------------------------------
-- 20. CHITIETTRALOI - Chi tiết câu trả lời
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS CHITIETTRALOI;
CREATE TABLE CHITIETTRALOI (
  maPhieu        INT           NOT NULL,
  maCauHoi       INT           NOT NULL,
  noiDungTraLoi  NVARCHAR(1000) NOT NULL,
  PRIMARY KEY (maPhieu, maCauHoi),
  FOREIGN KEY (maPhieu)  REFERENCES PHIEUTRALOI(maPhieu) ON DELETE CASCADE,
  FOREIGN KEY (maCauHoi) REFERENCES CAUHOIKHAOSAT(maCauHoi) ON DELETE CASCADE
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
DROP VIEW IF EXISTS V_DOANHTHU_NGAY;
CREATE VIEW V_DOANHTHU_NGAY AS
SELECT date(ngayDat) AS ngay,
       COUNT(*)      AS soDon,
       SUM(tongTien) AS doanhThu
FROM DONHANG
WHERE trangThai = N'Hoàn thành'
GROUP BY date(ngayDat);

DROP VIEW IF EXISTS V_SANPHAM_BANCHAY;
CREATE VIEW V_SANPHAM_BANCHAY AS
SELECT sp.maSP, sp.tenSP, l.tenLoai,
       SUM(ct.soLuong)   AS tongSoLuong,
       SUM(ct.thanhTien) AS tongDoanhThu
FROM CHITIETDONHANG ct
JOIN DONHANG d ON d.maDH = ct.maDH AND d.trangThai = N'Hoàn thành'
JOIN SANPHAM sp ON sp.maSP = ct.maSP
JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
GROUP BY sp.maSP, sp.tenSP, l.tenLoai;

DROP VIEW IF EXISTS V_TONKHO;
CREATE VIEW V_TONKHO AS
SELECT sp.maSP, sp.tenSP, l.tenLoai, sp.gia, sp.soLuong,
       (sp.soLuong * sp.gia) AS giaTriTon,
       sp.trangThai
FROM SANPHAM sp
JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai;
-- -----------------------------------------------------------------------------
-- 21. NHATKYSAOLUU - Nhật ký sao lưu cơ sở dữ liệu (yêu cầu mục II.1)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS NHATKYSAOLUU;
CREATE TABLE NHATKYSAOLUU (
  maNK       INT          PRIMARY KEY AUTOINCREMENT,
  tenFile    VARCHAR(100) NOT NULL,
  ghiChu     NVARCHAR(255) NULL,
  kichThuoc  INT          NOT NULL DEFAULT 0,
  thoiDiem   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- =============================================================================
-- PHIẾU GIẢM GIÁ VÀ THÔNG BÁO CHO KHÁCH HÀNG
-- (Ưu đãi sinh nhật: giảm 50% cho 1 ly, hiệu lực 30 ngày kể từ ngày sinh nhật)
-- =============================================================================

CREATE TABLE PHIEUGIAMGIA (
  maPG             INT          PRIMARY KEY AUTOINCREMENT,
  maKH             INT          NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  maCode           TEXT         NOT NULL UNIQUE,
  tieuDe           TEXT         NOT NULL,
  moTa             TEXT,
  phanTramGiam     INT          NOT NULL,
  giamToiDa        REAL,
  soLanSuDungToiDa INT          NOT NULL DEFAULT 1,
  soLanDaSuDung    INT          NOT NULL DEFAULT 0,
  loai             TEXT         NOT NULL DEFAULT 'Khác',
  trangThai        TEXT         NOT NULL DEFAULT 'Chưa dùng',
  ngayTao          TEXT         NOT NULL DEFAULT (datetime('now','localtime')),
  ngayHetHan       TEXT,
  CONSTRAINT chk_phieugiamgia_phantram CHECK (phanTramGiam BETWEEN 1 AND 100),
  CONSTRAINT chk_phieugiamgia_solan CHECK (soLanDaSuDung >= 0 AND soLanSuDungToiDa >= 1)
);

CREATE INDEX idx_phieugiamgia_kh ON PHIEUGIAMGIA (maKH, trangThai);

CREATE TABLE THONGBAO (
  maTB     INT    PRIMARY KEY AUTOINCREMENT,
  maKH     INT    NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
  tieuDe   TEXT   NOT NULL,
  noiDung  TEXT,
  loai     TEXT   NOT NULL DEFAULT 'Thông tin',
  maPG     INT    REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL,
  daDoc    INT    NOT NULL DEFAULT 0,
  ngayTao  TEXT   NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao);
