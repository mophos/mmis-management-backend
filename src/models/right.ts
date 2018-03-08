import Knex = require('knex');
import * as moment from 'moment';

export class RightModel {
  all(knex: Knex) {
    return knex('um_rights')
  }

  save(knex: Knex, datas: any) {
    return knex('um_rights')
      .insert(datas);
  }

  update(knex: Knex, rightId: string, datas: any) {
    return knex('um_rights')
      .where('right_id', rightId)
      .update(datas);
  }

  detail(knex: Knex, rightId: string) {
    return knex('um_rights')
      .where('right_id', rightId);
  }

  remove(knex: Knex, rightId: string) {
    return knex('um_rights')
      .where('right_id', rightId)
      .del();
  }

}
