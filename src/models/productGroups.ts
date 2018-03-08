import Knex = require('knex');

export class ProductGroupModel {
  getList(db: Knex) {
    return db('mm_generic_types').orderBy('generic_type_name');
  }

}
