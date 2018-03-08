import Knex = require('knex');
import * as moment from 'moment';

export class PositionModel {
  all(knex: Knex) {
    return knex('um_positions')
  }

  save(knex: Knex, datas: any) {
    return knex('um_positions')
      .insert(datas);
  }

  update(knex: Knex, positionId: string, datas: any) {
    return knex('um_positions')
      .where('position_id', positionId)
      .update(datas);
  }

  detail(knex: Knex, positionId: string) {
    return knex('um_positions')
      .where('position_id', positionId);
  }

  remove(knex: Knex, positionId: string) {
    return knex('um_positions')
      .where('position_id', positionId)
      .del();
  }

}
