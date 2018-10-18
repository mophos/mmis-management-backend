import Knex = require('knex');
import * as moment from 'moment';
const request = require("request");
export class LoginModel {
  doLogin(knex: Knex, username: string, password, userWarehouseId) {
    return knex('um_users as u')
      .select('u.user_id', 'u.username', 'uw.access_right', 'uw.generic_type_id',
        'u.is_active', 'ps.position_name', 'uw.group_id', 'w.warehouse_id', 'w.warehouse_name', 'w.short_code as warehouse_code',
        'pu.start_date', 'pu.end_date', 'pu.people_user_id', 'p.people_id', 'w.his_hospcode',
        knex.raw('concat(t.title_name, p.fname, " ", p.lname) as fullname'))
      .innerJoin('um_people_users as pu', 'pu.user_id', 'u.user_id')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .leftJoin('um_positions as ps', 'ps.position_id', 'p.position_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw(`join um_user_warehouse as uw on uw.user_warehouse_id='${userWarehouseId}'`)
      .leftJoin('wm_warehouses as w', 'w.warehouse_id', 'uw.warehouse_id')
      .where('pu.inuse', 'Y')
      .where('u.is_active', 'Y')
      .where('uw.is_actived', 'Y')
      .where({
        username: username,
        password: password
      })
      .limit(1);
  }
  sysSettings(knex: Knex) {
    return knex('sys_settings')
  }

  getVersion(knex: Knex) {
    return knex('versions')
  }

  getSystemSetting(knex: Knex) {
    return knex('sys_settings as s')
      .select('s.action_name', knex.raw('IF(s.value is null,s.default,IF(TRIM(s.value)= "",s.default,s.value)) as action_value'))
  }

  warehouseSearch(knex: Knex, username) {
    return knex('um_users as u')
      .select('w.warehouse_id', 'w.warehouse_name', 'uwt.warehouse_type', 'uw.user_warehouse_id')
      .innerJoin('um_user_warehouse as uw', 'uw.user_id', 'u.user_id')
      .innerJoin('wm_warehouse_types as uwt', 'uwt.warehouse_type_id', 'uw.warehouse_type_id')
      .innerJoin('wm_warehouses as w', 'uw.warehouse_id', 'w.warehouse_id')
      .where('u.is_active', 'Y')
      .where('u.username', username);
  }
  saveLog(data) {
    return new Promise((resolve: any, reject: any) => {
      var options = {
        method: 'POST',
        url: 'http://api.mmis.mophos.me/login',
        // url: 'http://localhost:3011/login',
        headers:
        {
          'cache-control': 'no-cache',
          'content-type': 'application/json',

        },
        agentOptions: {
          rejectUnauthorized: false
        },
        body: { data: data },
        json: true
      };

      request(options, function (error, response, body) {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
  }
}
