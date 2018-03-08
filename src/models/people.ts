import Knex = require('knex');
import * as moment from 'moment';

export class PeopleModel {

  getTitles(knex: Knex) {
    return knex('um_titles')
  }

  getPositions(knex: Knex) {
    return knex('um_positions')
  }

  all(knex: Knex) {
    return knex('um_people as p')
      .select('p.*', 't.title_name', 'ps.position_name')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .leftJoin('um_positions as ps', 'ps.position_id', 'p.position_id')
      .orderByRaw('p.fname, p.lname')
      .groupByRaw('p.fname, p.lname');
  }

  save(knex: Knex, data: any) {
    return knex('um_people')
      .insert(data);
  }

  update(knex: Knex, peopleId: any, data: any) {
    return knex('um_people')
      .update(data)
      .where('people_id', peopleId);
  }

  remove(knex: Knex, peopleId: any) {
    return knex('um_people')
      .where('people_id', peopleId)
      .del();
  }
}