/**
 * Xây dựng truy vấn danh sách: lọc động, tìm kiếm tiếng Việt không dấu,
 * sắp xếp có kiểm soát (chống SQL injection) và phân trang.
 */
'use strict';

const { PAGE_SIZE, MAX_PAGE_SIZE } = require('../config');
const { badRequest } = require('./errors');
const { unaccent } = require('./text');

/** Bộ gom điều kiện WHERE an toàn (tham số hóa hoàn toàn). */
class FilterBuilder {
  constructor() {
    /** @type {string[]} */
    this.conditions = [];
    /** @type {Record<string, unknown>} */
    this.params = {};
    this.counter = 0;
  }

  /** Sinh tên tham số duy nhất. */
  nextParam(prefix) {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  /** Thêm điều kiện thô; $params là object tham số kèm theo. */
  raw(conditionSql, params = {}) {
    this.conditions.push(conditionSql);
    Object.assign(this.params, params);
    return this;
  }

  /** So sánh bằng. Bỏ qua nếu giá trị rỗng/null. */
  equals(columnSql, value) {
    if (value === undefined || value === null || value === '') return this;
    const name = this.nextParam('f');
    this.conditions.push(`${columnSql} = :${name}`);
    this.params[name] = value;
    return this;
  }

  /** Lọc theo tập giá trị (IN). */
  inList(columnSql, values) {
    if (!Array.isArray(values) || values.length === 0) return this;
    const names = values.map(() => this.nextParam('f'));
    this.conditions.push(`${columnSql} IN (${names.map((n) => `:${n}`).join(', ')})`);
    names.forEach((name, index) => {
      this.params[name] = values[index];
    });
    return this;
  }

  /** Lọc theo khoảng giá trị (số). */
  between(columnSql, from, to) {
    if (from === undefined || from === null || from === '') return this;
    const name = this.nextParam('f');
    this.conditions.push(`${columnSql} >= :${name}`);
    this.params[name] = from;
    if (to !== undefined && to !== null && to !== '') {
      const nameTo = this.nextParam('f');
      this.conditions.push(`${columnSql} <= :${nameTo}`);
      this.params[nameTo] = to;
    }
    return this;
  }

  /**
   * Tìm kiếm không dấu trên nhiều cột.
   * @param {string} keyword
   * @param {string[]} columnsSql
   */
  search(keyword, columnsSql) {
    const needle = unaccent(keyword);
    if (!needle || columnsSql.length === 0) return this;
    const name = this.nextParam('s');
    const parts = columnsSql.map((column) => `UNACCENT(COALESCE(${column}, '')) LIKE :${name}`);
    this.conditions.push(`(${parts.join(' OR ')})`);
    this.params[name] = `%${needle}%`;
    return this;
  }

  /** Trả về mệnh đề WHERE (rỗng nếu không có điều kiện). */
  toWhere() {
    if (this.conditions.length === 0) return { sql: '', params: {} };
    return { sql: `WHERE ${this.conditions.join(' AND ')}`, params: this.params };
  }
}

/** Đọc tham số phân trang từ query string. */
function parsePagination(query) {
  const rawPage = Number(query.page ?? 1);
  const rawSize = Number(query.pageSize ?? PAGE_SIZE);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  let pageSize = Number.isFinite(rawSize) && rawSize >= 1 ? Math.floor(rawSize) : PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/** Gói dữ liệu trả về kèm thông tin phân trang. */
function paginate(items, total, pagination) {
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  return {
    items,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasPrev: pagination.page > 1,
      hasNext: pagination.page < totalPages,
    },
  };
}

/**
 * Sinh mệnh đề ORDER BY an toàn từ danh sách cột cho phép.
 * @param {object} query
 * @param {Record<string,string>} sortMap ánh xạ tên sắp xếp -> biểu thức SQL
 * @param {string} defaultSort khóa sắp xếp mặc định
 */
function buildOrderBy(query, sortMap, defaultSort) {
  const requested = String(query.sortBy ?? '').trim();
  const direction =
    String(query.sortDir ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  if (requested && Object.prototype.hasOwnProperty.call(sortMap, requested)) {
    return `ORDER BY ${sortMap[requested]} ${direction}`;
  }
  if (defaultSort && Object.prototype.hasOwnProperty.call(sortMap, defaultSort)) {
    return `ORDER BY ${sortMap[defaultSort]} ASC`;
  }
  throw badRequest('Cấu hình sắp xếp không hợp lệ.');
}

/**
 * Chạy truy vấn danh sách kèm phân trang.
 * @param {object} options
 * @param {string} options.selectSql câu SELECT (không gồm WHERE/ORDER/LIMIT)
 * @param {string} options.countSql câu SELECT COUNT tương ứng
 * @param {FilterBuilder} options.filter
 * @param {string} options.orderBy
 * @param {{limit:number, offset:number}} options.pagination
 * @param {Function} options.runAll hàm thực thi (sql, params) => rows
 * @param {Function} options.runGet hàm thực thi (sql, params) => row
 */
function executePaged({ selectSql, countSql, filter, orderBy, pagination, runAll, runGet }) {
  const { sql: whereSql, params } = filter.toWhere();
  const total = runGet(`${countSql} ${whereSql}`, params)?.total ?? 0;
  const items = runAll(
    `${selectSql} ${whereSql} ${orderBy} LIMIT :limit OFFSET :offset`,
    { ...params, limit: pagination.limit, offset: pagination.offset }
  );
  return { items, total };
}

module.exports = {
  FilterBuilder,
  parsePagination,
  paginate,
  buildOrderBy,
  executePaged,
};
