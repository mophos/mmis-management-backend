import Knex = require('knex');
import * as moment from 'moment';

export class HolidayModel {

  getholidays(knex: Knex) {
    return knex('sys_holidays').orderBy('date')
  }

  getType(knex: Knex) {
    return [
      { type: 'วันหยุดราชการ' },
      { type: 'วันหยุดชดเชยราชการ' },
      { type: 'วันสำคัญอื่นๆ (ไม่ใช่วันหยุดราชการ)' }];
  }
  updateActive(knex: Knex, id, active) {
    return knex('sys_holidays')
      .update('is_active', active)
      .where('id', id);
  }
  add(knex: Knex, data: any) {
    return knex('sys_holidays')
      .insert(data);
  }
  updateHoliday(knex: Knex, id, data) {
    return knex('sys_holidays')
      .update(data)
      .where('id', id);
  }
  deleteHoliday(knex: Knex, id) {
    return knex('sys_holidays')
      .where('id', id)
      .del();
  }
}