import Knex = require('knex');

export class reportModel {
  getHeader(db: Knex) {
    return db('um_report');
  }
  getDetail(db: Knex, reportId) {
    return db('um_report_detail')
      .where('report_id', reportId);
  }

  setActive(knex: Knex, id) {
    return knex('um_report_detail')
      .update('is_active', 'Y')
      .where('report_detail_id', id);
  }

  setDisActive(knex: Knex, id) {
    return knex('um_report_detail')
      .update('is_active', 'N')
      .where('report_id', id);
  }
  setActiveSignature(knex: Knex, id) {
    return knex('um_report_detail')
      .update('signature', 'Y')
      .where('report_detail_id', id);
  }

  setDisActiveSignature(knex: Knex, id) {
    return knex('um_report_detail')
      .update('signature', 'N')
      .where('report_detail_id', id);
  }
  setLine(knex: Knex, reportDetailId, line) {
    return knex('um_report_detail')
      .update('line', line)
      .where('report_detail_id', reportDetailId);
  }
}