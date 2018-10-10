import Knex = require('knex');
import * as moment from 'moment';

export class SerialModel {

  getSerialFormat(knex: Knex) {
    return knex('sys_serial_format')
      .orderBy('serial_format_id');
  }

  getSerial(knex: Knex, year, warehouseId) {
    return knex('sys_serials as s')
      .join('sys_serial_format as f', 'f.serial_format_id', 's.serial_format_id')
      .where('s.sr_year', year)
      .where('s.warehouse_id', warehouseId)
      .orderBy('s.comment');
  }

  getSerialInfo(knex: Knex, type) {
    return knex('sys_serials as s')
      .join('sys_serial_format as f', 'f.serial_format_id', 's.serial_format_id')
      .where('s.sr_type', type);
  }

  updateSerial(knex: Knex, type, formatId, runningNumber, year, warehouseId) {
    return knex('sys_serials')
      .where('sr_type', type)
      .where('sr_year', year)
      .where('warehouse_id', warehouseId)
      .update({
        'serial_format_id': formatId,
        'sr_no': runningNumber
      });
  }

}