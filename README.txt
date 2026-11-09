COFFEE CRM - HUONG DAN CAI DAT VA SU DUNG
========================================

1. GIOI THIEU
-------------
Ung dung quan ly hoat dong ban coffee: san pham, ton kho, khach hang,
nhan vien, don hang, nhap hang, tich diem, khuyen mai, phan hoi, khao sat
va bao cao.

Cong nghe: Node.js (HTTP API), giao dien HTML/CSS/JavaScript va PostgreSQL.

2. YEU CAU
---------
- Node.js 22.5 tro len.
- PostgreSQL dang chay.
- pgAdmin de quan tri va xem du lieu tren PostgreSQL (khuyen nghi).

3. CAI DAT VA KHOI TAO CO SO DU LIEU
------------------------------------
Mo PowerShell tai thu muc du an va cai dat cac goi phu thuoc:

    npm install

Mac dinh ung dung dung PostgreSQL tren 127.0.0.1:5432, tai khoan postgres,
co so du lieu DAS va mat khau du phong 123456. Neu PostgreSQL tren may ban
dung mat khau khac, dat thong tin ket noi trong PowerShell:

    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = 'MAT_KHAU_POSTGRES_CUA_BAN'
    $env:PGDATABASE = 'DAS'

Tao database, bang va du lieu mau:

    npm run init-db
    npm run seed

Lenh init-db tu dong tao database PostgreSQL neu tai khoan co quyen tao
database.

CANH BAO: npm run seed XOA va tao lai cac bang/dong du lieu trong database
da cau hinh truoc khi nap du lieu demo. Chi chay tren database demo hoac
sau khi da sao luu du lieu can giu.

Tai khoan demo do seed tao:

    Admin      : admin                / Admin@123
    Quan ly    : an.nv@coffeecrm.vn   / Coffee@123
    Nhan vien  : bich.tt@coffeecrm.vn / Coffee@123
    Khach hang : 0912000001           / Khach@123

Chuc vu nhan vien duoc gan quyen theo nghiep vu:
    Nhan vien ban hang     : tao va xu ly don hang, xem san pham/khach hang.
    Nhan vien quan ly don  : quan ly trang thai va xu ly don hang.
    Nhan vien kho          : xem ton kho, lap va xu ly phieu nhap; chi chon
                             nha cung cap dang hop tac, khong quan ly danh ba NCC.
    Nhan vien CSKH         : xem khach hang, tiep nhan/xu ly phan hoi va xem khao sat.
Admin va Quan ly co quyen quan ly nha cung cap, danh muc, nhan vien va bao cao.
Tai khoan Nhan vien ban hang trong danh sach tren dung de thu chuc nang don hang.
Co the tao them chuc vu tu man hinh Nhan vien de thu cac luong Kho, Quan ly don,
va CSKH; tai khoan moi mac dinh dung mat khau Coffee@123 neu khong nhap mat khau.

4. CHAY UNG DUNG
----------------
Trong cung cua so PowerShell da dat bien moi truong:

    npm start

Mo trinh duyet tai http://127.0.0.1:3000. Dung may chu bang Ctrl+C.

Dang nhap Admin tai http://127.0.0.1:3000/admin. Cong nay co nut dien nhanh
tai khoan demo Admin. Trang chinh khong nhan tai khoan Admin; Quan ly, Nhan vien
va Khach hang dang nhap tai dia chi goc. Sau khi dang nhap Admin, trang quan tri
duoc mo tai /admin/panel.

Co the doi cong va dia chi lang nghe:

    $env:PORT = '3001'
    $env:HOST = '127.0.0.1'
    npm start

Chi dat HOST=0.0.0.0 neu can truy cap ung dung tu may khac trong mang noi bo.

5. GOI Y THU THU CONG
---------------------
- Dang nhap bang mot tai khoan demo o muc 3.
- Thu cac khu vuc san pham, khach hang, nhan vien, don hang, nhap hang,
  khuyen mai, tich diem, phan hoi, khao sat va bao cao.
- Tao don roi kiem tra ton kho; huy don roi xac nhan ton kho duoc hoan lai.
- Thu hai phien trinh duyet tao don gan dong thoi cho cung mot san pham de
  kiem tra he thong tu choi don vuot qua ton kho con lai.

6. DUNG PostgreSQL VOI pgAdmin
-----------------------------
pgAdmin la cong cu giao dien quan tri PostgreSQL; ung dung ket noi truc tiep
toi PostgreSQL, khong ket noi vao cua so pgAdmin. Hai ben dung cung PostgreSQL
server va database thi du lieu ung dung tao se hien thi trong pgAdmin.

Trong pgAdmin, xem du lieu tai Servers > PostgreSQL > Databases > DAS >
Schemas > public > Tables. Neu dat PGDATABASE thanh ten khac, mo database do.

Khi khong ket noi duoc, kiem tra PostgreSQL dang chay va cac gia tri PGHOST,
PGPORT, PGUSER, PGPASSWORD, PGDATABASE. Ung dung khong tu doc tep .env; hay
dat bien moi truong trong PowerShell truoc khi chay.

7. COOKIE KHI DUNG HTTPS
------------------------
Neu dat ung dung sau HTTPS/reverse proxy, bat thuoc tinh Secure cho cookie:

    $env:COOKIE_SECURE = 'true'

Khong bat tuy chon nay khi thu bang HTTP localhost, vi trinh duyet se khong
gui cookie Secure qua ket noi HTTP.

8. CAC TEP CHINH
----------------
- src/routes: API va khai bao phan quyen.
- src/services: nghiep vu cua tung phan he.
- src/db: ket noi PostgreSQL, chuyen doi SQL va migration.
- database/schema-pg.sql va database/schema.sql: cau truc co so du lieu.
- public: giao dien web.
- YC: ERD va tai lieu mo ta yeu cau.
- scripts/seed.js: du lieu va tai khoan demo.

9. LENH HUU ICH
---------------
    npm start          Chay ung dung
    npm run dev        Chay che do tu khoi dong lai khi sua ma
    npm run init-db    Tao database/bang
    npm run seed       Xoa du lieu cu va nap lai du lieu demo
    npm run kiem-tra   Chay script kiem tra API co san

README nay khong tu dong chay lenh kiem tra. Hay dam bao cau hinh dung
database truoc khi chay init-db hoac seed.
