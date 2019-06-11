import Knex = require('knex');
import * as moment from 'moment';

export class PositionModel {
  all(knex: Knex) {
    return knex('um_positions')
      .where('is_deleted', 'N')
  }

  save(knex: Knex, datas: any) {
    return knex('um_positions')
      .insert(datas, 'people_id');
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
      .update({ 'is_deleted': 'Y' })
  }

  unActive(knex: Knex, peopleId: string) {
    return knex('um_people_positions')
      .where('people_id', peopleId)
      .update({ 'is_actived': 'N' });
  }

  savePositionUser(knex: Knex, data: string) {
    return knex('um_people_positions')
      .insert(data);
  }
  log(knex: Knex, peopleId: string) {
    return knex('um_people_positions as pp')
      .select('pp.position_id', 'pp.create_date', 'p.position_name', 'pp.people_id')
      .join('um_positions as p', 'p.position_id', 'pp.position_id')
      .where('people_id', peopleId);
  }

}
