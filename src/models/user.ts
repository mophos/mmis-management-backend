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

  /**
   * ประวัติการใช้งานของผู้ใช้รายคน (ใช้กับ modal "ประวัติการใช้งาน")
   *
   * คอลัมน์ ip_address / user_agent / device_info / username เป็นของที่ SQL migration
   * ของงาน 2FA เพิ่มเข้ามา จึงต้องเลือกมาแบบมีเงื่อนไข — ถ้า select ตรงๆ แล้วโรงพยาบาล
   * ยังไม่ได้รัน migration modal นี้จะพังทั้งหน้าจอ
   *
   * securityReady ส่งมาจาก route ที่เช็ค isSecurityReady() ไว้แล้ว
   */
  getActionLogs(knex: Knex, userId: any, securityReady: boolean = false) {
    const columns: any[] = [
      'l.system', 'l.action', 'l.remark', 'l.action_time',
      knex.raw('concat(t.title_name, p.fname, " ", p.lname) as people_fullname'),
      'ps.position_name'
    ];

    if (securityReady) {
      columns.push('l.ip_address', 'l.user_agent', 'l.device_info', 'l.username');
    }

    return knex('um_logs as l')
      .select(columns)
      .leftJoin('um_people_users as pu', 'pu.people_user_id', 'l.people_user_id')
      .leftJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .where('l.user_id', userId)
      .orderBy('l.action_time', 'DESC');
  }

  /**
   * สถานะความปลอดภัยของผู้ใช้คนเดียว (2FA / การล็อกบัญชี / การบังคับเปลี่ยนรหัส)
   *
   * แยกเป็น query ต่างหาก ไม่รวมเข้ากับ detail() เพราะคอลัมน์เหล่านี้จะมีก็ต่อเมื่อ
   * รัน SQL migration แล้ว ถ้าเอาไปใส่ใน detail() ตรงๆ หน้าจัดการผู้ใช้ของโรงพยาบาล
   * ที่ยังไม่ได้รัน migration จะพังทั้งหน้า
   */
  securityStatus(knex: Knex, userId: any) {
    return knex('um_users')
      .select('user_id', 'totp_enabled', 'totp_confirmed_at', 'locked_until',
        'failed_login_count', 'must_change_password', 'password_changed_at', 'password_algo')
      .where('user_id', userId)
      .limit(1);
  }

  /**
   * รหัสผ่านปัจจุบัน + วิธี hash ใช้ตรวจนโยบายก่อนเปลี่ยนรหัสผ่าน
   * (ต้องรู้ค่าเดิมเพื่อกันการตั้งรหัสใหม่ซ้ำกับรหัสปัจจุบัน)
   *
   * password_algo มีเฉพาะหลังรัน migration จึงเลือกมาแบบมีเงื่อนไข
   * ก่อน migration ทุกแถวเป็น md5 อยู่แล้ว ผู้เรียกจึงใช้ 'md5' แทนได้
   */
  securityStatusPassword(knex: Knex, userId: any, securityReady: boolean = false) {
    const columns = securityReady ? ['password', 'password_algo'] : ['password'];

    return knex('um_users')
      .select(columns)
      .where('user_id', userId)
      .limit(1);
  }

  /** สถานะความปลอดภัยของผู้ใช้ทุกคน ใช้กับหน้ารายชื่อ */
  securityStatusAll(knex: Knex) {
    return knex('um_users')
      .select('user_id', 'totp_enabled', 'locked_until', 'must_change_password');
  }

  /**
   * อัปเดตรหัสผ่านพร้อมฟิลด์ที่เกี่ยวข้อง (password_algo, password_changed_at,
   * must_change_password) ที่ประกอบมาจาก buildPasswordFields() ใน routes/users.ts
   *
   * เดิมเมธอดนี้ชื่อ changePassword() และเขียนเฉพาะคอลัมน์ password ซึ่งใช้ไม่ได้แล้ว
   * เพราะจะทำให้ password กับ password_algo ไม่ตรงกัน แล้วเจ้าของบัญชีเข้าระบบไม่ได้
   */
  updatePasswordFields(knex: Knex, userId: any, fields: any) {
    return knex('um_users')
      .where('user_id', userId)
      .update(fields);
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