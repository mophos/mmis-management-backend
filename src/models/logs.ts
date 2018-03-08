import Knex = require('knex');
import * as moment from 'moment';

export class LogModel {
  saveLog(knex: Knex, logs: any) {
    return knex('um_logs')
      .insert(logs);
  }

  getLog(knex: Knex, userId: any) {
    return knex('um_logs')
      .where({ user_id: userId })
      .limit(100);
  }
}
