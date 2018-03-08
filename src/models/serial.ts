import Knex = require('knex');
import * as moment from 'moment';

export class SerialModel {

  getSerialFormat(knex: Knex) {
    return knex('sys_serial_format')
    .orderBy('serial_format_id');
  }

  getSerial(knex: Knex) {
    return knex('sys_serials as s')
      .join('sys_serial_format as f', 'f.serial_format_id', 's.serial_format_id')
      .orderBy('comment');
  }

  getSerialInfo(knex: Knex, type) {
    return knex('sys_serials as s')
      .join('sys_serial_format as f', 'f.serial_format_id', 's.serial_format_id')
      .where('s.sr_type', type);
  }

  updateSerial(knex: Knex, type, formatId, runningNumber) {
    return knex('sys_serials')
      .where('sr_type', type)
      .update({
        'serial_format_id': formatId,
        'sr_no': runningNumber
      });
  }

}