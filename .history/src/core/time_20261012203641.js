/**
 * Tiện ích thời gian. Mọi giá trị DATETIME lưu trong CSDL đều theo giờ địa
 * phương và có định dạng 'YYYY-MM-DD HH:MM:SS'.
 */
'use strict';

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Chuyển Date -> 'YYYY-MM-DD HH:MM:SS'. */
function toSqlDateTime(date = new Date()) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Chuyển Date -> 'YYYY-MM-DD'. */
function toSqlDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Thời điểm hiện tại dạng DATETIME. */
function nowSql() {
  return toSqlDateTime();
}

/** Ngày hôm nay dạng DATE. */
function todaySql() {
  return toSqlDate();
}

/** Cộng thêm số giờ vào thời điểm hiện tại. */
function hoursFromNow(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return toSqlDateTime(date);
}

/** Cộng/trừ số ngày so với hôm nay, trả về DATE. */
function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toSqlDate(date);
}

/** Chuyển chuỗi DATETIME trong CSDL thành Date (an toàn với mọi runtime). */
function parseSqlDateTime(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tính tuổi từ ngày sinh (DATE). */
function ageFromBirthDate(birthDate, reference = new Date()) {
  if (!birthDate) return null;
  const date = parseSqlDateTime(birthDate);
  if (!date) return null;
  let age = reference.getFullYear() - date.getFullYear();
  const monthDiff = reference.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

module.exports = {
  toSqlDateTime,
  toSqlDate,
  nowSql,
  todaySql,
  hoursFromNow,
  daysFromToday,
  parseSqlDateTime,
  ageFromBirthDate,
};
