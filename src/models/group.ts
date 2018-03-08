import Knex = require('knex');
import * as moment from 'moment';

export class GroupModel {
  list(knex: Knex) {
    return knex('um_groups')
  }

  save(knex: Knex, datas: any) {
    return knex('um_groups')
      .insert(datas);
  }

  update(knex: Knex, groupId: string, datas: any) {
    return knex('um_groups')
      .where('group_id', groupId)
      .update(datas);
  }

  detail(knex: Knex, groupId: string) {
    return knex('um_groups')
      .where('group_id', groupId);
  }

  remove(knex: Knex, groupId: string) {
    return knex('um_groups')
      .where('group_id', groupId)
      .del();
  }

  getRights(knex: Knex, groupId: string) {
    return knex('um_group_rights')
      .select('right_id')
      .where('group_id', groupId);
  }

  saveRights(knex: Knex, data: any) {
    return knex('um_group_rights')
      .insert(data);
  }

  removeRights(knex: Knex, groupId: any) {
    return knex('um_group_rights')
      .where('group_id', groupId)
      .del();
  }

}
