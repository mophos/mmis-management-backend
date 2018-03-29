import Knex = require('knex');

export class reportModel {
  getList(db: Knex) {
    return db('um_report').orderBy('report_type');
  }

  updateActive(knex: Knex, id, active, type) {
    return knex('um_report')
      .update('is_active', active)
      .where('id', id)
      .andWhere('report_type', type);
  }

  updateN(knex: Knex, id, type) {
    return knex('um_report')
      .update('is_active', 'N')
      .whereNot('id', id)
      .andWhere('report_type', type);
  }
}