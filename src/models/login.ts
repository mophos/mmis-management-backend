import Knex = require('knex');
import * as moment from 'moment';

export class LoginModel {

  /**
   * ดึงข้อมูลผู้ใช้ตาม username + คลัง โดย "ไม่" กรองด้วยรหัสผ่านใน SQL
   *
   * เดิม query นี้ใส่ password ลงใน WHERE ได้เพราะเป็น md5 ที่เทียบตรงๆ ได้
   * แต่ bcrypt เทียบใน SQL ไม่ได้ (ทุก hash มี salt ต่างกัน) จึงต้องดึงแถวมาก่อน
   * แล้วเทียบใน node ด้วย PasswordModel.verify()
   *
   * เงื่อนไขอื่นทั้งหมด (is_active, inuse, is_actived) คงไว้เหมือนเดิมทุกประการ
   *
   * !! การ join um_user_warehouse ต้องผูกกับ uw.user_id = u.user_id เสมอ
   *    โค้ดเดิม join ด้วย user_warehouse_id อย่างเดียว ทำให้ผู้ใช้ส่ง user_warehouse_id
   *    ของคนอื่นเข้ามาแล้วได้ access_right/คลัง/generic type ของคนนั้นไปเลย
   *    และค่านั้นถูกต่อเข้า SQL ตรงๆ จึงเป็นช่องทาง SQL injection ด้วย
   */
  getUserForLogin(knex: Knex, username: string, userWarehouseId) {
    return knex('um_users as u')
      .select('u.user_id', 'u.username', 'uw.access_right', 'uw.generic_type_id', 'uw.generic_type_lv2_id', 'uw.generic_type_lv3_id',
        'u.is_active', 'ps.position_name', 'uw.group_id', 'w.warehouse_id', 'w.warehouse_name', 'w.short_code as warehouse_code', 'w.warehouse_book',
        'pu.start_date', 'pu.end_date', 'pu.people_user_id', 'p.people_id', 'w.his_hospcode',
        'u.password', 'u.password_algo', 'u.must_change_password',
        'u.totp_secret', 'u.totp_enabled', 'u.failed_login_count', 'u.locked_until',
        knex.raw('concat(t.title_name, p.fname, " ", p.lname) as fullname'))
      .innerJoin('um_people_users as pu', 'pu.user_id', 'u.user_id')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw('join um_user_warehouse as uw on uw.user_warehouse_id = ? and uw.user_id = u.user_id', [userWarehouseId])
      .leftJoin('wm_warehouses as w', 'w.warehouse_id', 'uw.warehouse_id')
      .where('pu.inuse', 'Y')
      .where('u.is_active', 'Y')
      .where('uw.is_actived', 'Y')
      .where('u.username', username)
      .limit(1);
  }

  /** ใช้กับ flow เดิม (ยังไม่ได้รัน SQL migration) — เทียบ md5 ใน SQL แบบเดิมทุกประการ */
  doLoginLegacy(knex: Knex, username: string, password, userWarehouseId) {
    return knex('um_users as u')
      .select('u.user_id', 'u.username', 'uw.access_right', 'uw.generic_type_id', 'uw.generic_type_lv2_id', 'uw.generic_type_lv3_id',
        'u.is_active', 'ps.position_name', 'uw.group_id', 'w.warehouse_id', 'w.warehouse_name', 'w.short_code as warehouse_code', 'w.warehouse_book',
        'pu.start_date', 'pu.end_date', 'pu.people_user_id', 'p.people_id', 'w.his_hospcode',
        knex.raw('concat(t.title_name, p.fname, " ", p.lname) as fullname'))
      .innerJoin('um_people_users as pu', 'pu.user_id', 'u.user_id')
      .innerJoin('um_people as p', 'p.people_id', 'pu.people_id')
      .joinRaw(`left join um_people_positions as upp on upp.people_id = p.people_id and upp.is_actived ='Y'`)
      .leftJoin('um_positions as ps', 'ps.position_id', 'upp.position_id')
      .leftJoin('um_titles as t', 't.title_id', 'p.title_id')
      .joinRaw('join um_user_warehouse as uw on uw.user_warehouse_id = ? and uw.user_id = u.user_id', [userWarehouseId])
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

  /**
   * ตรวจว่าฐานข้อมูลรัน migration แล้วหรือยัง
   *
   * ถ้ายังไม่ได้รัน (คอลัมน์ยังไม่ครบ) ระบบต้องวิ่ง flow เดิม 100% ไม่ใช่พังทั้งระบบ
   * เพราะแต่ละโรงพยาบาลรัน SQL เองคนละเวลากับตอน deploy โค้ด
   */
  async hasSecurityColumns(knex: Knex): Promise<boolean> {
    return this.hasColumns(knex, 'um_users', [
      'must_change_password', 'password_algo', 'password_md5_legacy',
      'totp_secret', 'totp_enabled', 'failed_login_count', 'locked_until'
    ]);
  }

  /**
   * ตรวจคอลัมน์ของ um_logs แยกจาก um_users
   *
   * ต้องแยกกันเพราะถ้า migration ถูกรันไม่ครบ (ALTER um_users สำเร็จ แต่ ALTER um_logs
   * ล้มเหลว เช่นตารางใหญ่แล้ว timeout) การใช้ผลของ um_users มาตัดสินว่า um_logs
   * มีคอลัมน์แล้ว จะทำให้ INSERT log พังแล้วล้มการเข้าสู่ระบบทั้งหมด
   */
  async hasLogColumns(knex: Knex): Promise<boolean> {
    return this.hasColumns(knex, 'um_logs', [
      'username', 'ip_address', 'user_agent', 'device_info', 'created_at'
    ]);
  }

  private async hasColumns(knex: Knex, tableName: string, required: string[]): Promise<boolean> {
    const rs: any = await knex('information_schema.columns')
      .count('* as total')
      .where('table_schema', knex.raw('DATABASE()'))
      .where('table_name', tableName)
      .whereIn('column_name', required);

    return rs.length > 0 && +rs[0].total === required.length;
  }

  /**
   * บันทึกรหัสผ่านใหม่เป็น bcrypt พร้อมเก็บ md5 เดิมไว้ที่ password_md5_legacy
   * (เก็บไว้ 90 วันตามที่ตกลง แล้วค่อยลบด้วย SQL ในไฟล์ ROLLBACK)
   */
  changePassword(knex: Knex, userId: any, hashedPassword: string, legacyMd5: string) {
    const data: any = {
      password: hashedPassword,
      password_algo: 'bcrypt',
      password_changed_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      must_change_password: 'N'
    };

    // เขียน legacy เฉพาะครั้งแรกที่ย้ายจาก md5 ไม่งั้นการเปลี่ยนรหัสรอบถัดไป
    // จะไปทับค่าเดิมด้วย bcrypt hash ซึ่งไม่ใช่ md5 แล้ว
    if (legacyMd5) {
      data.password_md5_legacy = legacyMd5;
    }

    return knex('um_users')
      .where('user_id', userId)
      .update(data);
  }

  enableTotp(knex: Knex, userId: any, encryptedSecret: string) {
    return knex('um_users')
      .where('user_id', userId)
      .update({
        totp_secret: encryptedSecret,
        totp_enabled: 'Y',
        totp_confirmed_at: moment().format('YYYY-MM-DD HH:mm:ss')
      });
  }

  resetTotp(knex: Knex, userId: any) {
    return knex('um_users')
      .where('user_id', userId)
      .update({
        totp_secret: null,
        totp_enabled: 'N',
        totp_confirmed_at: null
      });
  }

  forceChangePassword(knex: Knex, userId: any) {
    return knex('um_users')
      .where('user_id', userId)
      .update({ must_change_password: 'Y' });
  }

  /**
   * นับครั้งที่กรอกผิด (รวมทั้งรหัสผ่านผิดและ OTP ผิด) และล็อกบัญชีเมื่อครบเกณฑ์
   * คืนจำนวนครั้งที่เหลือ เพื่อให้หน้าจอเตือนผู้ใช้ก่อนจะโดนล็อกจริง
   */
  async registerFailedAttempt(knex: Knex, userId: any, maxFailed: number, lockMinutes: number) {
    await knex('um_users')
      .where('user_id', userId)
      .increment('failed_login_count', 1);

    const rs: any = await knex('um_users')
      .select('failed_login_count')
      .where('user_id', userId)
      .limit(1);

    const count = rs.length ? +rs[0].failed_login_count : 0;

    if (count >= maxFailed) {
      const lockedUntil = moment().add(lockMinutes, 'minutes').format('YYYY-MM-DD HH:mm:ss');

      await knex('um_users')
        .where('user_id', userId)
        .update({ failed_login_count: 0, locked_until: lockedUntil });

      return { locked: true, remaining: 0, lockedUntil: lockedUntil };
    }

    return { locked: false, remaining: maxFailed - count, lockedUntil: null };
  }

  clearFailedAttempts(knex: Knex, userId: any) {
    return knex('um_users')
      .where('user_id', userId)
      .update({ failed_login_count: 0, locked_until: null });
  }

  getGenericTypeLV2(knex: Knex, genericTypeLv1Id) {
    return knex('mm_generic_types_lv2')
      .whereIn('generic_type_lv1_id', genericTypeLv1Id)
  }

  getGenericTypeLV3(knex: Knex, genericTypeLv1Id) {
    return knex('mm_generic_types_lv3')
      .whereIn('generic_type_lv1_id', genericTypeLv1Id)
  }

  sysSettings(knex: Knex) {
    return knex('sys_settings')
  }

  getVersion(knex: Knex) {
    return knex('versions')
      .orderBy('version', 'DESC')
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

  // saveLog() ที่ยิง HTTP ไป http://api.mmis.mophos.me/login ถูกถอดออกแล้ว
  // ปลายทางไม่มีให้บริการแล้ว และมันถูก await คาไว้ใน request path ของ login
  // ทำให้ทุกครั้งที่มีคนเข้าสู่ระบบต้องรอ DNS/TCP timeout ก่อนเสมอ
  // ข้อมูล deviceInfo ที่เคยส่งออกไป ตอนนี้เก็บลง um_logs.device_info แทน
}
