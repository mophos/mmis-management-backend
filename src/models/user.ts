import Knex = require('knex');
import * as moment from 'moment';
import * as crypto from 'crypto';

export class UserModel {

  generateHash(password: string) {
    return crypto.createHash('md5').update(password).digest('hex');
  }

  all(knex: Knex) {
    return knex('um_users as u')
      .select('u.user_id', 'u.username',
        'u.is_active', 'pu.people_user_id', 'ps.position_name',
        knex.raw('concat(t.title_name, p.fname, " ", p.lname) as fullname'))
      // .leftJoin('um_groups as g', 'g.group_id', 'u.group_id')
      .innerJoin('um_people_users as pu', 'pu.user_id', 'u.user_id')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .where('pu.inuse', 'Y')
      .groupBy('u.username');
  }

  getWarehouses(knex: Knex) {
    return knex('wm_warehouses')
      .where('is_actived', 'Y')
      .andWhere('is_deleted', 'N')
      .orderBy('warehouse_name');
  }

  getGroups(knex: Knex) {
    return knex('um_groups')
      .orderBy('group_name');
  }

  getRights(knex: Knex) {
    return knex('um_rights')
      .orderBy('right_name');
  }

  right(knex: Knex, module, warehouseTypeId) {
    let sql = `select * from um_rights where right_module = '${module}' `;
    if (+warehouseTypeId == 1) {
      sql += ` and is_main_warehouse = 'Y'`;
    } else if (+warehouseTypeId == 2) {
      sql += ` and is_sub_warehouse = 'Y'`;
    }
    sql += ` order by right_name`;
    return knex.raw(sql);
  }

  save(knex: Knex, data: any) {
    return knex('um_users')
      .insert(data, 'user_id');
  }
  saveRight(knex: Knex, right) {
    return knex('um_user_warehouse')
      .insert(right);
  }

  update(knex: Knex, data: any, userId: string) {
    return knex('um_users')
      .update(data)
      .where('user_id', userId);
  }

  remove(knex: Knex, userId: string) {
    return knex('um_users')
      .where('user_id', userId)
      .del();
  }

  removeUserWarehouse(knex: Knex, userId: string) {
    return knex('um_user_warehouse')
      .where('user_id', userId)
      .del();
  }

  detail(knex: Knex, userId: string) {
    return knex('um_users as u')
      .select('u.user_id', 'u.username',
        'u.is_active', 'ps.position_id', 'ps.position_name',
        'pu.start_date', 'pu.end_date', 'pu.people_user_id', 'p.people_id',
        knex.raw('concat(t.title_name, p.fname, " ", p.lname) as fullname'))
      .innerJoin('um_people_users as pu', 'pu.user_id', 'u.user_id')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .where('pu.inuse', 'Y')
      .where('u.user_id', userId);
  }

  getUserWarehouse(knex: Knex, userId: string) {
    return knex('um_user_warehouse as u')
      .select('u.*', 'wt.warehouse_type', 'w.*')
      .innerJoin('wm_warehouses as w', 'u.warehouse_id', 'w.warehouse_id')
      .innerJoin('wm_warehouse_types as wt', 'u.warehouse_type_id', 'wt.warehouse_type_id')
      .where('user_id', userId)
  }

  setUnused(knex: Knex, userId: string) {
    return knex('um_people_users')
      .where('user_id', userId)
      .update({ inuse: 'N' });
  }

  savePeople(knex: Knex, data: any) {
    let sql = `INSERT INTO 
    um_people_users(people_user_id, people_id, user_id, start_date, end_date)
    VALUES('${data.people_user_id}', '${data.people_id}', '${data.user_id}', 
    '${data.start_date}', '${data.end_date}') ON DUPLICATE KEY UPDATE
    start_date='${data.start_date}', end_date='${data.end_date}', inuse='Y'
    `;

    return knex.raw(sql);
  }

  getSwitchLogs(knex: Knex, userId: any) {
    return knex('um_people_users as pu')
      .select('t.title_name', 'p.fname', 'p.lname',
        'ps.position_name', 'pu.start_date', 'pu.end_date', 'pu.inuse')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .where('pu.user_id', userId)
      .orderBy('pu.start_date', 'DESC');
  }

  getActionLogs(knex: Knex, userId: any) {
    /*
    select 
    from um_logs as l
    inner join um_people_users as pu on pu.people_user_id=l.people_user_id
    left join um_people as p on p.people_id=pu.people_id
    where l.user_id=1
    order by l.action_time desc
    */
    return knex('um_logs as l')
      .select('l.system', 'l.action', 'l.remark',
        'l.action_time', knex.raw('concat(t.title_name, p.fname, " ", p.lname) as people_fullname'),
        'ps.position_name')
      .leftJoin('um_people_users as pu', 'pu.people_user_id', 'l.people_user_id')
      .leftJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .where('l.user_id', userId)
      .orderBy('l.action_time', 'DESC');
  }

  changePassword(knex: Knex, userId: any, password: any) {
    return knex('um_users')
      .where('user_id', userId)
      .update({
        password: password
      });
  }

  getGenericTypeLV1(knex: Knex) {
    return knex('mm_generic_types')
      .select('generic_type_id as generic_type_lv1_id', 'generic_type_name as generic_type_lv1_name')
      .where('is_deleted', 'N')
  }

  getGenericTypeLV2(knex: Knex) {
    return knex('mm_generic_types_lv2 as m2')
      .select('m1.generic_type_name as generic_type_lv1_name', 'm2.generic_type_lv1_id',
        'm2.generic_type_lv2_id', 'm2.generic_type_lv2_name')
      .join('mm_generic_types as m1', 'm1.generic_type_id', 'm2.generic_type_lv1_id')
      .where('m2.is_deleted', 'N')
  }

  getGenericTypeLV3(knex: Knex) {
    return knex('mm_generic_types_lv3 as m3')
      .select('m1.generic_type_name as generic_type_lv1_name', 'm2.generic_type_lv1_id',
        'm2.generic_type_lv2_id', 'm2.generic_type_lv2_name',
        'm3.generic_type_lv3_id', 'm3.generic_type_lv3_name')
      .join('mm_generic_types as m1', 'm1.generic_type_id', 'm3.generic_type_lv1_id')
      .join('mm_generic_types_lv2 as m2', 'm2.generic_type_lv2_id', 'm3.generic_type_lv2_id')
      .where('m3.is_deleted', 'N')
  }
}