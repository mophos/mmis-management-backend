import Knex = require('knex');
import * as moment from 'moment';
import { loadavg } from 'os';

export class ApproveModel {

  getLits(knex: Knex) {
    return knex('sys_approve as a')
      .select('a.*', 'p.fname', 'p.lname', 'u.user_id', 'u.username')
      .leftJoin('um_people as p', 'a.people_id', 'p.people_id')
      .leftJoin('um_users as u', 'u.user_id', 'a.user_id')
  }


  getUser(knex: Knex) {
    return knex('um_users as u')
      .select('u.*', 'p.fname', 'p.lname')
      .leftJoin('um_people_users as pu', 'u.user_id', 'pu.user_id')
      .leftJoin('um_people as p', 'pu.people_id', 'p.people_id')
      .where('u.is_active','Y')
  }

  autoComplete(knex: Knex, q: any, limit: number = 100, offset: number = 0) {
    return knex('um_users as u')
      .select('u.*', knex.raw('concat(u.username," ( ",p.fname, " ",p.lname ," )") as fullname'))
      .leftJoin('um_people_users as pu', 'u.user_id', 'pu.user_id')
      .leftJoin('um_people as p', 'pu.people_id', 'p.people_id')
      .where('p.fname', 'like', `%${q}%`)
      .orWhere('p.lname', 'like', `%${q}%`)
      .orWhere('u.username', 'like', `%${q}%`)

  }

  save(knex: Knex, data: any) {
    return knex('sys_approve')
      .insert(data);
  }

  update(knex: Knex, data: any) {
    return knex('sys_approve')
      .update(data)
      .where('user_id', data.user_id)
      .andWhere('action_name', data.action_name);
  }

  remove(knex: Knex, data: any) {
    return knex('sys_approve')
      .where('user_id', data.user_id)
      .andWhere('action_name', data.action_name)
      .del();
  }
}