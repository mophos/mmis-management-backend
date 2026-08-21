import { PeopleModel } from './../models/people';
import * as express from 'express';
const router = express.Router();
import * as wrap from 'co-express';
import * as moment from 'moment';
import * as crypto from 'crypto';

import { UserModel } from '../models/user';
import { LoginModel } from '../models/login';
import { LogModel } from '../models/logs';
import { PasswordModel } from '../models/password';
import { isSecurityReady, isTrustedDeviceReady } from '../models/security-feature';
import { describeDevice } from '../models/device-info';
import { TrustedDeviceModel } from '../models/trusted-device';

const userModel = new UserModel();
const peopleModel = new PeopleModel();
const loginModel = new LoginModel();
const logModel = new LogModel();
const passwordModel = new PasswordModel();
const trustedDevice = new TrustedDeviceModel();

/**
 * เพิกถอนอุปกรณ์ที่ผู้ใช้จำไว้ทั้งหมด
 *
 * เรียกทุกครั้งที่มีการเปลี่ยนแปลงเรื่องความปลอดภัยของบัญชี (สเปกข้อ 6)
 * ถ้าไม่เพิกถอน คนที่เคยเข้าถึงเบราว์เซอร์เครื่องนั้นได้จะยังข้าม OTP เข้าระบบต่อได้
 * ทั้งที่เจ้าของเพิ่งเปลี่ยนรหัสผ่านหรือเพิ่งย้ายมือถือใหม่ — กลายเป็นว่ามาตรการ
 * ที่เพิ่งทำไปไม่มีผลกับเครื่องที่เสี่ยงที่สุด
 *
 * ไม่ throw ออกไป เพราะงานหลัก (เปลี่ยนรหัส/รีเซ็ต 2FA) สำเร็จไปแล้ว
 * ถ้าโยน error ผู้ดูแลจะเห็นว่าล้มเหลวทั้งที่ของจริงทำไปแล้วครึ่งทาง
 */
async function revokeTrustedDevices(db, userId: any): Promise<void> {
  try {
    if (await isTrustedDeviceReady(db)) {
      await trustedDevice.revokeAll(db, userId);
    }
  } catch (error) {
    console.log('[trusted-device] เพิกถอนอุปกรณ์ไม่สำเร็จ:', error.message);
  }
}

/**
 * ประกอบฟิลด์รหัสผ่านให้ตรงกับสถานะของฐานข้อมูล
 *
 * ถ้ายังไม่ได้รัน SQL migration ต้องเขียนเป็น md5 แบบเดิมเท่านั้น เพราะ flow login
 * เดิมเทียบรหัสผ่านใน SQL ถ้าเผลอเขียน bcrypt ลงไปผู้ใช้คนนั้นจะเข้าระบบไม่ได้เลย
 *
 * forceChange = true สำหรับกรณีที่ admin เป็นคนตั้งรหัสให้ (สร้างผู้ใช้ใหม่ / รีเซ็ตรหัส)
 * ผู้ใช้ต้องเปลี่ยนเองในการ login ครั้งถัดไป admin จะได้ไม่รู้รหัสผ่านของคนอื่นตลอดไป
 */
async function buildPasswordFields(db, plainPassword: string, forceChange: boolean) {
  if (!await isSecurityReady(db)) {
    return { password: userModel.generateHash(plainPassword) };
  }

  const fields: any = {
    password: passwordModel.hash(plainPassword),
    password_algo: 'bcrypt',
    password_changed_at: moment().format('YYYY-MM-DD HH:mm:ss')
  };

  if (forceChange) {
    fields.must_change_password = 'Y';
  }

  return fields;
}

router.get('/all', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    const rows: any = await userModel.all(db);

    // แนบสถานะ 2FA / การล็อกบัญชี ให้หน้ารายชื่อกวาดตาเห็นได้ว่าใครมีปัญหา
    // ทำเฉพาะเมื่อรัน migration แล้ว ไม่งั้นหน้ารายชื่อจะพังทั้งหน้า
    if (await isSecurityReady(db)) {
      const status: any = await userModel.securityStatusAll(db);
      const byUserId = {};
      status.forEach(s => { byUserId[s.user_id] = s; });

      rows.forEach(r => {
        const s = byUserId[r.user_id];
        r.totp_enabled = s ? s.totp_enabled : null;
        r.must_change_password = s ? s.must_change_password : null;
        r.is_locked = s && s.locked_until && moment(s.locked_until).isAfter(moment()) ? 'Y' : 'N';
      });
    }

    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

router.get('/warehouses-list', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    const rows = await userModel.getWarehouses(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

router.get('/groups-list', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    const rows = await userModel.getGroups(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

router.get('/rights-list', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    const rows = await userModel.getRights(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

router.get('/action-logs/:userId', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    let userId = req.params.userId;
    const securityReady = await isSecurityReady(db);
    const rows = await userModel.getActionLogs(db, userId, securityReady);
    let logs = [];
    rows.forEach(v => {
      let obj: any = {};
      obj.system = v.system;
      obj.action = v.action;
      obj.remark = v.remark;
      obj.people_fullname = v.people_fullname;
      obj.position_name = v.position_name;
      obj.date = moment(v.action_time, 'x').format('YYYY-MM-DD');
      obj.time = moment(v.action_time, 'x').format('HH:mm:ss');

      // ข้อมูลตรวจสอบย้อนหลังที่มาพร้อม SQL migration ของงาน 2FA
      obj.ip_address = v.ip_address || null;
      obj.username = v.username || null;
      obj.device = describeDevice(v.user_agent, v.device_info);

      logs.push(obj);
    });
    res.send({ ok: true, rows: logs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

router.delete('/:userId', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;
  if (userId) {
    try {
      await userModel.remove(db, userId);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    }
  } else {
    res.send({ ok: false, error: 'ไม่พบรหัสผู้ใช้งาน' });
  }
}));

router.get('/:userId', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;
  if (userId) {
    try {
      let detail = await userModel.detail(db, userId);
      let userWarehouse = await userModel.getUserWarehouse(db, userId);
      let _userWarehouse = [];
      userWarehouse.forEach(u => {
        const obj = {
          warehouse_name: u.warehouse_name,
          warehouse_id: u.warehouse_id,
          warehouse_type: u.warehouse_type,
          warehouse_type_id: u.warehouse_type_id,
          group_id: u.group_id,
          access_right: u.access_right,
          generic_type_id: u.generic_type_id,
          generic_type_lv1_id: u.generic_type_id,
          generic_type_lv2_id: u.generic_type_lv2_id,
          generic_type_lv3_id: u.generic_type_lv3_id,
          is_actived: u.is_actived
        }
        _userWarehouse.push(obj);
      });
      detail[0].rights = _userWarehouse;

      // แนบสถานะความปลอดภัยให้หน้าแก้ไขผู้ใช้แสดงผลและตัดสินใจว่าปุ่มไหนควรกดได้
      // ทำเฉพาะเมื่อรัน migration แล้ว หน้าจอฝั่ง frontend เช็ค undefined อยู่แล้ว
      if (await isSecurityReady(db)) {
        const status: any = await userModel.securityStatus(db, userId);
        if (status.length) {
          detail[0].security = {
            totp_enabled: status[0].totp_enabled,
            totp_confirmed_at: status[0].totp_confirmed_at,
            must_change_password: status[0].must_change_password,
            password_changed_at: status[0].password_changed_at,
            password_algo: status[0].password_algo,
            failed_login_count: status[0].failed_login_count,
            locked_until: status[0].locked_until,
            // แปลงเป็น boolean แท้ ไม่ปล่อยเป็น null เพราะหน้าจอเอาไปใช้เปิด/ปิดปุ่มปลดล็อก
            is_locked: !!(status[0].locked_until && moment(status[0].locked_until).isAfter(moment()))
          };
        }
      }

      res.send({ ok: true, detail: detail[0] });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    }
  } else {
    res.send({ ok: false, error: 'ไม่พบรหัสผู้ใช้งาน' });
  }
}));

router.get('/people/list', wrap(async (req, res, next) => {
  const db = req.db;
  try {
    let rows = await peopleModel.all(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/switch-logs/:userId', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;
  if (userId) {
    try {
      let rows = await userModel.getSwitchLogs(db, userId);
      res.send({ ok: true, rows: rows });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ไม่พบรหัสผู้ใช้งาน' });
  }
}));

router.post('/', wrap(async (req, res, next) => {
  const db = req.db;
  let data: any  = req.body.data;
  let rights: any  = req.body.rights;

  if (data.peopleId && data.startDate && data.username && data.password && data.isActive && rights.length) {
    try {
      let _data: any = {};
      _data.username = data.username;
      _data.is_active = data.isActive;
      // ผู้ใช้ใหม่ต้องเปลี่ยนรหัสผ่านเองในการ login ครั้งแรกเสมอ
      Object.assign(_data, await buildPasswordFields(db, data.password, true));

      let ids = await userModel.save(db, _data);
      rights.forEach(r => {
        r.user_id = ids[0];
      });
      await userModel.saveRight(db, rights);

      let peopleUser: any = {};
      peopleUser.user_id = ids[0];
      peopleUser.people_user_id = moment().format('x');
      peopleUser.people_id = data.peopleId;
      peopleUser.start_date = moment(data.startDate, 'YYYY-MM-DD').isValid() ? data.startDate : '0000-00-00';
      peopleUser.end_date = moment(data.endDate, 'YYYY-MM-DD').isValid() ? data.endDate : '0000-00-00';
      await userModel.savePeople(db, peopleUser);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบ' });
  }

}));

router.put('/:userId', wrap(async (req, res, next) => {
  const db = req.db;
  let userId = req.params.userId;
  let data: any  = req.body.data;
  let rights: any  = req.body.rights;
  if (data.peopleId && data.startDate && data.isActive && rights.length) {
    try {
      let _data: any = {};
      // admin ตั้งรหัสให้ -> บังคับให้เจ้าตัวเปลี่ยนเองในการ login ครั้งถัดไป
      if (data.password) {
        Object.assign(_data, await buildPasswordFields(db, data.password, true));
      }
      _data.is_active = data.isActive;
      let _rights = [];
      rights.forEach(r => {
        const obj = {
          user_id: userId,
          warehouse_id: r.warehouse_id,
          warehouse_type_id: r.warehouse_type_id,
          generic_type_id: r.generic_type_id,
          generic_type_lv2_id: r.generic_type_lv2_id,
          generic_type_lv3_id: r.generic_type_lv3_id,
          group_id: r.group_id,
          access_right: r.access_right,
          is_actived: r.is_actived
        }
        _rights.push(obj);
      });
      // สเปกข้อ 6.1 — admin ตั้งรหัสใหม่ให้ ก็ถือเป็นการเปลี่ยนรหัสผ่านเช่นกัน
      if (data.password) {
        await revokeTrustedDevices(db, userId);
      }

      await userModel.setUnused(db, userId);
      await userModel.update(db, _data, userId);
      await userModel.removeUserWarehouse(db, userId);
      await userModel.saveRight(db, _rights);


      let peopleUser: any = {};
      peopleUser.user_id = userId;
      peopleUser.people_user_id = moment().format('x');
      peopleUser.people_id = data.peopleId;
      peopleUser.start_date = data.startDate;
      peopleUser.end_date = data.endDate;
      await userModel.savePeople(db, peopleUser);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบ' });
  }
}));

/**
 * เปลี่ยนรหัสผ่านของตัวเอง (เข้าถึงได้เฉพาะสิทธิ์ UM_ADMIN ตาม middleware ของ /users)
 *
 * ต้องเขียนรหัสผ่านด้วยวิธีเดียวกับที่ flow login ใช้เทียบเสมอ ถ้าเขียน md5 ทับ
 * แถวที่ password_algo = 'bcrypt' ไว้ เจ้าของบัญชีจะเข้าระบบไม่ได้อีกเลย
 * เพราะการเทียบจะไปเรียก bcrypt.compare กับข้อความที่ไม่ใช่ bcrypt hash
 */
router.post('/change-password', wrap(async (req, res, next) => {

  let db = req.db;
  let userId = req.decoded.id;
  let password: any = req.body.password;

  try {
    if (!password) {
      res.send({ ok: false, error: 'กรุณาระบุรหัสผ่านใหม่' });
      return;
    }

    /**
     * ต้องตรวจนโยบายรหัสผ่านที่นี่ด้วย ไม่ใช่แค่ในหน้าเข้าสู่ระบบ
     *
     * endpoint นี้เคลียร์ must_change_password ให้เลย ถ้าไม่ตรวจ ผู้ใช้จะเลี่ยงนโยบาย
     * (อย่างน้อย 8 ตัว มีตัวอักษร+ตัวเลข ห้ามซ้ำรหัสเดิม) ได้ด้วยการมาเปลี่ยนทางนี้แทน
     */
    const securityReady = await isSecurityReady(db);
    const current: any = await userModel.securityStatusPassword(db, userId, securityReady);

    if (current.length) {
      // ก่อนรัน migration ยังไม่มีคอลัมน์ password_algo และทุกแถวเป็น md5 อยู่แล้ว
      const algo = securityReady ? current[0].password_algo : 'md5';
      const check = passwordModel.checkPolicy(password, password, current[0].password, algo);

      if (!check.ok) {
        res.send({ ok: false, error: check.error });
        return;
      }
    }

    // เปลี่ยนเอง ไม่ต้องบังคับเปลี่ยนซ้ำในการ login ครั้งถัดไป
    const fields = await buildPasswordFields(db, password, false);

    if (await isSecurityReady(db)) {
      fields.must_change_password = 'N';
    }

    await userModel.updatePasswordFields(db, userId, fields);

    // สเปกข้อ 6.1 — เปลี่ยนรหัสผ่านแล้วต้องเพิกถอนอุปกรณ์ที่จำไว้ทุกเครื่อง
    await revokeTrustedDevices(db, userId);

    await logModel.saveLog(db, logModel.buildLogData(req, 'CHANGE_PASSWORD', {
      userId: userId,
      username: req.decoded.username || null,
      remark: 'Changed own password via /users/change-password'
    }));

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    // เดิม handler นี้ไม่ปิด connection ทำให้ pool รั่วทุกครั้งที่เรียก
    db.destroy();
  }

}));

// ---------------------------------------------------------------------------
// เครื่องมือสำหรับผู้ดูแลระบบ (ได้สิทธิ์ UM_ADMIN จาก middleware ของ /users แล้ว)
// ---------------------------------------------------------------------------

/** ล้างค่า 2FA ให้ผู้ใช้ — ใช้กรณีทำมือถือหาย เปลี่ยนเครื่อง หรือลบแอปทิ้ง */
router.post('/:userId/reset-2fa', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;

  try {
    if (!await isSecurityReady(db)) {
      res.send({ ok: false, error: 'ฐานข้อมูลยังไม่ได้ติดตั้งส่วนขยายความปลอดภัย กรุณารัน SQL migration ก่อน' });
      return;
    }

    await loginModel.resetTotp(db, userId);

    // สเปกข้อ 6.2 — ถ้าไม่เพิกถอน เครื่องเก่าที่เคยจำไว้จะยังข้าม OTP ได้
    // ทั้งที่ผู้ใช้กำลังจะสแกน QR ใหม่เพราะมือถือเดิมหายไปแล้ว
    await revokeTrustedDevices(db, userId);

    await logModel.saveLog(db, logModel.buildLogData(req, '2FA_RESET', {
      userId: userId,
      remark: `Reset by admin (user_id ${req.decoded.id})`
    }));

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

/** ปลดล็อกบัญชีทันทีโดยไม่ต้องรอครบเวลา */
router.post('/:userId/unlock', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;

  try {
    if (!await isSecurityReady(db)) {
      res.send({ ok: false, error: 'ฐานข้อมูลยังไม่ได้ติดตั้งส่วนขยายความปลอดภัย กรุณารัน SQL migration ก่อน' });
      return;
    }

    await loginModel.clearFailedAttempts(db, userId);

    await logModel.saveLog(db, logModel.buildLogData(req, 'ACCOUNT_UNLOCK', {
      userId: userId,
      remark: `Unlocked by admin (user_id ${req.decoded.id})`
    }));

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

/**
 * รายการอุปกรณ์ที่ผู้ใช้สั่งให้จำไว้
 *
 * ไม่คืน device_hash ออกไปเด็ดขาด (listByUser ไม่ select มาให้อยู่แล้ว)
 * ถ้าหลุดออกไป ผู้ที่ได้ไปจะเทียบหาเครื่องได้ว่า cookie ใบไหนตรงกับแถวไหน
 */
router.get('/:userId/trusted-devices', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;

  try {
    // ยังไม่ได้รัน SQL ของรอบนี้ -> ตอบว่าไม่มีอุปกรณ์ ไม่ใช่ error
    // หน้าจอจะได้แสดงตารางว่างแทนที่จะขึ้นข้อความแดงทั้งที่ระบบปกติดี
    if (!await isTrustedDeviceReady(db)) {
      res.send({ ok: true, rows: [], available: false });
      return;
    }

    const rows: any = await trustedDevice.listByUser(db, userId);
    const now = moment();

    rows.forEach(r => {
      r.is_expired = !r.expires_at || moment(r.expires_at).isSameOrBefore(now);
    });

    res.send({ ok: true, rows: rows, available: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

/** เพิกถอนอุปกรณ์ที่จำไว้ทั้งหมดของผู้ใช้ (สเปกข้อ 6.3) */
router.delete('/:userId/trusted-devices', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;

  try {
    if (!await isTrustedDeviceReady(db)) {
      res.send({ ok: false, error: 'ฐานข้อมูลยังไม่ได้ติดตั้งตารางจดจำอุปกรณ์ กรุณารัน SQL migration ก่อน' });
      return;
    }

    const removed = await trustedDevice.revokeAll(db, userId);

    await logModel.saveLog(db, logModel.buildLogData(req, 'TRUSTED_DEVICE_REVOKE', {
      userId: userId,
      remark: `Revoked ${removed} trusted device(s) by admin (user_id ${req.decoded.id})`
    }));

    res.send({ ok: true, removed: removed });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

/** สั่งให้ผู้ใช้ต้องเปลี่ยนรหัสผ่านในการ login ครั้งถัดไป */
router.post('/:userId/force-change-password', wrap(async (req, res, next) => {
  const db = req.db;
  const userId = req.params.userId;

  try {
    if (!await isSecurityReady(db)) {
      res.send({ ok: false, error: 'ฐานข้อมูลยังไม่ได้ติดตั้งส่วนขยายความปลอดภัย กรุณารัน SQL migration ก่อน' });
      return;
    }

    await loginModel.forceChangePassword(db, userId);

    // สเปกข้อ 6.4 + ข้อ 7 — กรณีนี้คือ "สงสัยรหัสผ่านรั่ว" ผู้ใช้ต้องกรอก OTP ด้วย
    // จึงต้องเพิกถอนอุปกรณ์ ไม่ใช่แค่ตั้ง flag บังคับเปลี่ยนรหัส
    await revokeTrustedDevices(db, userId);

    await logModel.saveLog(db, logModel.buildLogData(req, 'CHANGE_PASSWORD', {
      userId: userId,
      remark: `Force change password flagged by admin (user_id ${req.decoded.id})`
    }));

    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/rights/module', wrap(async (req, res, next) => {

  let db = req.db;
  let module: any  = req.query.module;
  let warehouseTypeId: any  = req.query.warehouseTypeId;

  try {
    const rs = await userModel.right(db, module, warehouseTypeId);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }

}));

router.get('/genericType/lv1', wrap(async (req, res, next) => {

  let db = req.db;
  try {
    const rs = await userModel.getGenericTypeLV1(db);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));
router.get('/genericType/lv2', wrap(async (req, res, next) => {

  let db = req.db;
  try {
    const rs = await userModel.getGenericTypeLV2(db);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));
router.get('/genericType/lv3', wrap(async (req, res, next) => {

  let db = req.db;
  try {
    const rs = await userModel.getGenericTypeLV3(db);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  }
}));

export default router;