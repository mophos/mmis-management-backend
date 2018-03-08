import Knex = require('knex');
import * as moment from 'moment';

export class TitleModel {
  all(knex: Knex) {
    return knex('um_titles')
  }

  save(knex: Knex, datas: any) {
    return knex('um_titles')
      .insert(datas);
  }

  update(knex: Knex, titleId: string, datas: any) {
    return knex('um_titles')
      .where('title_id', titleId)
      .update(datas);
  }

  detail(knex: Knex, titleId: string) {
    return knex('um_titles')
      .where('title_id', titleId);
  }

  remove(knex: Knex, titleId: string) {
    return knex('um_titles')
      .where('title_id', titleId)
      .del();
  }

}
