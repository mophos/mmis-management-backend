import { LogModel } from './../models/logs';
import * as express from 'express';
import * as wrap from 'co-express';
import * as moment from 'moment';
import * as _ from 'lodash';

import { Jwt } from '../models/jwt';

import { LoginModel } from '../models/login';
import { PasswordModel } from '../models/password';
import { TwoFactorModel } from '../models/two-factor';
import { CryptoUtil } from '../models/crypto-util';
import preAuth, { checkPreAuth } from '../models/pre-auth';
import { isSecurityReady } from '../models/security-feature';

const loginModel = new LoginModel();
const logModel = new LogModel();
const passwordModel = new PasswordModel();
const twoFactor = new TwoFactorModel();
const cryptoUtil = new CryptoUtil();

const jwt = new Jwt();

const router = express.Router();

function getSetting(settings: any[], name: string, fallback: string): string {
  const found: any = _.find(settings, { 'action_name': name });
  return found && found.action_value !== null && found.action_value !== undefined
    ? String(found.action_value)
    : fallback;
}

function getHospitalName(settings: any[]): string {
  try {
    const sysHospital: any = _.find(settings, { 'action_name': 'SYS_HOSPITAL' });
    return sysHospital ? JSON.parse(sysHospital.action_value).hospname : '';
  } catch (error) {
    return '';
  }
}

/** ประกอบ JWT payload ตัวจริง — โครงสร้างเดิมทุกฟิลด์ ห้ามเปลี่ยน มี 7 โมดูลอ่านอยู่ */
function buildTokenPayload(user: any, settings: any[]): any {
  const expired: any = _.filter(settings, { 'action_name': 'WM_EXPIRED_YEAR_FORMAT' });

  const payload = {
    fullname: user.fullname,
    id: user.user_id,
    accessRight: user.access_right,
    people_user_id: user.people_user_id,
    people_id: user.people_id,
    warehouseId: user.warehouse_id,
    warehouseCode: user.warehouse_code,
    warehouseName: user.warehouse_name,
    his_hospcode: user.his_hospcode,
    warehouseBook: user.warehouse_book ? user.warehouse_book : '',
    generic_type_id: user.generic_type_id,
    generic_type_lv2_id: user.generic_type_lv2_id ? user.generic_type_lv2_id : '',
    generic_type_lv3_id: user.generic_type_lv3_id ? user.generic_type_lv3_id : '',
    expired: expired.length ? expired[0].action_value == '1' ? 'BE' : 'BC' : 'BC'
  };

  settings.forEach(v => {
    payload[v.action_name] = v.action_value;
  });

  return payload;
}

/**
 * ตัดสินว่าผู้ใช้ต้องทำขั้นตอนอะไรต่อ
 *
 * ลำดับที่ตกลงไว้:
 *   ยังไม่เคยตั้ง 2FA -> เปลี่ยนรหัสผ่านก่อน แล้วค่อยตั้ง 2FA
 *   ตั้ง 2FA แล้ว     -> ยืนยัน OTP ก่อน แล้วค่อยเปลี่ยนรหัสผ่าน (ถ้าจำเป็น)
 *
 * เหตุผลที่สลับลำดับตามสถานะ: ถ้าผู้ใช้ตั้ง 2FA ไว้แล้วแต่ยอมให้เปลี่ยนรหัสผ่าน
 * ก่อนยืนยัน OTP คนที่ขโมยรหัสผ่านไปจะยึดบัญชีได้ทันที
 */
function decideNextStep(user: any, twoFaEnabled: boolean, forceChangeEnabled: boolean,
                        totpVerified: boolean = false): string {
  const mustChange = forceChangeEnabled && user.must_change_password === 'Y';
  const hasTotp = user.totp_enabled === 'Y' && !!user.totp_secret;

  // totpVerified บอกว่าผู้ใช้ผ่าน OTP ไปแล้วในรอบการเข้าสู่ระบบนี้
  // ถ้าไม่เช็ค ผู้ใช้ที่ถูกสั่งให้เปลี่ยนรหัสผ่านจะโดนถาม OTP ซ้ำอีกรอบหลังเปลี่ยนรหัสเสร็จ
  if (twoFaEnabled && hasTotp && !totpVerified) {
    return '2fa_verify';
  }

  if (mustChange) {
    return 'change_password';
  }

  if (twoFaEnabled && !hasTotp) {
    return '2fa_setup';
  }

  return 'done';
}

/** ออก token จริง + บันทึก log LOGIN สำเร็จ ใช้ร่วมกันทุก step ที่จบขั้นตอนสุดท้าย */
async function completeLogin(req, db, user: any, settings: any[], deviceInfo: any) {
  if (await isSecurityReady(db)) {
    await loginModel.clearFailedAttempts(db, user.user_id);
  }

  const token = jwt.sign(buildTokenPayload(user, settings));

  await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN', {
    userId: user.user_id,
    peopleId: user.people_id,
    peopleUserId: user.people_user_id,
    username: user.username,
    deviceInfo: deviceInfo,
    remark: `${user.username} -> Success`
  }));

  return token;
}

/**
 * โหลดข้อมูลผู้ใช้ใหม่จากฐานข้อมูลในทุก step
 * ไม่เชื่อสถานะที่ฝังมาใน pre-auth token เพราะ admin อาจ reset 2FA ระหว่างทางได้
 */
async function loadUser(db, username: string, userWarehouseId: any) {
  const rs: any = await loginModel.getUserForLogin(db, username, userWarehouseId);
  return rs.length ? rs[0] : null;
}

async function loadSettings(db) {
  return await loginModel.getSystemSetting(db);
}

// POST /genpass ถูกลบออกแล้ว — เป็นเครื่องมือ dev ที่รับรหัสผ่านมาแล้วคืน md5 hash
// โดยไม่มี auth ป้องกัน ใครก็เรียกได้ ไม่มีประโยชน์อีกแล้วเพราะระบบใช้ bcrypt

router.get('/warehouse/search', wrap(async (req, res, next) => {
  let db = req.db;
  let username: any = req.query.username;
  let rs = await loginModel.warehouseSearch(db, username);

  if (rs.length) {
    res.send({ ok: true, rows: rs });
  } else {
    res.send({ ok: false });
  }
}));

// ---------------------------------------------------------------------------
// ขั้นที่ 1 : ตรวจชื่อผู้ใช้ + รหัสผ่าน
// ---------------------------------------------------------------------------
router.post('/', wrap(async (req, res, next) => {
  const username: any = req.body.username;
  const password: any = req.body.password;
  const userWarehouseId: any = req.body.userWarehouseId;
  const deviceInfo: any = req.body.deviceInfo || {};
  const db = req.db;

  if (!username || !password || !userWarehouseId) {
    res.send({ ok: false, error: 'กรุณาระบุชื่อผู้ใช้งาน,รหัสผ่านและคลัง' });
    return;
  }

  try {
    const settings = await loadSettings(db);
    const ready = await isSecurityReady(db);

    // ยังไม่ได้รัน SQL migration -> ทำงานแบบเดิมทุกประการ
    if (!ready) {
      const encPassword = passwordModel.md5(password);
      const legacy: any = await loginModel.doLoginLegacy(db, username, encPassword, userWarehouseId);

      if (legacy.length) {
        const token = jwt.sign(buildTokenPayload(legacy[0], settings));
        await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN', {
          userId: legacy[0].user_id,
          peopleId: legacy[0].people_id,
          peopleUserId: legacy[0].people_user_id,
          username: username,
          deviceInfo: deviceInfo,
          remark: `${username} -> Success`
        }));
        res.send({ ok: true, token: token });
      } else {
        await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN_FAIL', {
          username: username,
          deviceInfo: deviceInfo,
          remark: `${username} -> Incorrect username or password`
        }));
        res.send({ ok: false, error: 'ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง' });
      }
      return;
    }

    const twoFaEnabled = getSetting(settings, 'SYS_2FA_ENABLE', 'N') === 'Y';
    const forceChangeEnabled = getSetting(settings, 'SYS_FORCE_CHANGE_PASSWORD', 'N') === 'Y';
    const maxFailed = +getSetting(settings, 'SYS_LOGIN_MAX_FAILED', '10');
    const lockMinutes = +getSetting(settings, 'SYS_LOGIN_LOCK_MINUTES', '15');

    const user = await loadUser(db, username, userWarehouseId);

    if (!user) {
      // ไม่มีผู้ใช้นี้ -> ไม่มีแถวให้นับครั้งที่ผิด บันทึก log อย่างเดียว
      await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN_FAIL', {
        username: username,
        deviceInfo: deviceInfo,
        remark: `${username} -> Incorrect username or password`
      }));
      res.send({ ok: false, error: 'ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง' });
      return;
    }

    if (user.locked_until && moment(user.locked_until).isAfter(moment())) {
      const minutesLeft = Math.max(1, moment(user.locked_until).diff(moment(), 'minutes'));
      res.send({
        ok: false,
        code: 'LOCKED',
        error: `บัญชีถูกระงับชั่วคราว กรุณาลองใหม่อีกครั้งใน ${minutesLeft} นาที`
      });
      return;
    }

    if (!passwordModel.verify(password, user.password, user.password_algo)) {
      const attempt = await loginModel.registerFailedAttempt(db, user.user_id, maxFailed, lockMinutes);

      await logModel.saveLog(db, logModel.buildLogData(req, attempt.locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: username,
        deviceInfo: deviceInfo,
        remark: attempt.locked
          ? `${username} -> Locked until ${attempt.lockedUntil}`
          : `${username} -> Incorrect password (remaining ${attempt.remaining})`
      }));

      if (attempt.locked) {
        res.send({
          ok: false,
          code: 'LOCKED',
          error: `กรอกรหัสผ่านผิดเกินกำหนด บัญชีถูกระงับ ${lockMinutes} นาที`
        });
      } else {
        res.send({
          ok: false,
          error: 'ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง',
          remainingAttempts: attempt.remaining
        });
      }
      return;
    }

    const next = decideNextStep(user, twoFaEnabled, forceChangeEnabled);

    if (next === 'done') {
      const token = await completeLogin(req, db, user, settings, deviceInfo);
      res.send({ ok: true, token: token });
      return;
    }

    /**
     * หน้าจอรุ่นเก่าไม่รู้จักขั้นตอนใหม่ มันจะอ่าน rs.token ทันทีที่เห็น ok = true
     * แล้วพังด้วย "Cannot read properties of undefined (reading 'split')" หน้าจอค้าง
     * ผู้ใช้ไม่รู้ว่าเกิดอะไรขึ้น
     *
     * ระหว่างที่ยังทยอย deploy ทีละโมดูล จึงให้หน้าจอที่รองรับแล้วส่ง
     * supportLoginSteps = true มาด้วย ถ้าไม่ส่งมาก็ตอบเป็นข้อความที่อ่านรู้เรื่องแทน
     *
     * นี่เป็นเรื่อง UX ไม่ใช่มาตรการความปลอดภัย (ปลอมค่านี้ได้) แต่ไม่เป็นช่องโหว่
     * เพราะเส้นทางนี้ปฏิเสธการเข้าระบบเสมอ ไม่มีทางได้ token กลับไป
     */
    if (req.body.supportLoginSteps !== true) {
      await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: user.username,
        deviceInfo: deviceInfo,
        remark: `${user.username} -> Outdated client, cannot handle step "${next}"`
      }));

      res.send({
        ok: false,
        code: 'CLIENT_OUTDATED',
        error: 'หน้าเข้าสู่ระบบนี้ยังไม่รองรับขั้นตอนความปลอดภัยใหม่ กรุณาเข้าสู่ระบบผ่านหน้าหลักของ MMIS'
      });
      return;
    }

    /**
     * ตั้งใจ "ไม่" ล้างตัวนับที่นี่
     *
     * ถ้าล้างตัวนับทุกครั้งที่รหัสผ่านถูก คนที่ขโมยรหัสผ่านไปจะเดา OTP ได้ไม่จำกัด
     * แค่เรียก POST /login ใหม่คั่นระหว่างการเดาแต่ละครั้ง ตัวนับก็กลับเป็นศูนย์
     * ทำให้การล็อกบัญชีหลังผิด 10 ครั้งไม่มีผลอะไรเลย
     *
     * ตัวนับจะถูกล้างเมื่อเข้าสู่ระบบสำเร็จจริงใน completeLogin()
     * หรือเมื่อผ่าน OTP แล้วเท่านั้น
     */

    // ต้องบันทึกไว้ด้วย ไม่งั้นจะตรวจย้อนหลังไม่ได้เลยว่าใครยืนยันรหัสผ่านสำเร็จบ้าง
    // (การเข้าสู่ระบบยังไม่สมบูรณ์ จึงใช้ action คนละตัวกับ LOGIN)
    await logModel.saveLog(db, logModel.buildLogData(req, 'LOGIN_PENDING', {
      userId: user.user_id,
      peopleId: user.people_id,
      peopleUserId: user.people_user_id,
      username: user.username,
      deviceInfo: deviceInfo,
      remark: `${user.username} -> Password ok, waiting for ${next}`
    }));

    res.send({
      ok: true,
      next: next,
      preAuthToken: preAuth.sign({
        userId: user.user_id,
        username: user.username,
        userWarehouseId: userWarehouseId
      })
    });

  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

// ---------------------------------------------------------------------------
// ขั้นที่ 2 : เปลี่ยนรหัสผ่าน (บังคับ)
// ---------------------------------------------------------------------------
router.post('/change-password', checkPreAuth, wrap(async (req, res, next) => {
  const db = req.db;
  const password: any = req.body.password;
  const confirmPassword: any = req.body.confirmPassword;

  try {
    const settings = await loadSettings(db);
    const user = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);

    if (!user) {
      res.send({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้งาน' });
      return;
    }

    const twoFaEnabled = getSetting(settings, 'SYS_2FA_ENABLE', 'N') === 'Y';
    const hasTotp = user.totp_enabled === 'Y' && !!user.totp_secret;

    /**
     * ผู้ใช้ที่ตั้ง 2FA ไว้แล้ว ต้องผ่าน OTP ก่อนถึงจะเปลี่ยนรหัสผ่านได้
     *
     * ถ้าไม่ตรวจตรงนี้ คนที่ขโมยรหัสผ่านไปจะเรียก endpoint นี้ตรงๆ ด้วย pre-auth token
     * ที่ได้จากขั้นแรก แล้วเปลี่ยนรหัสผ่านล็อกเจ้าของบัญชีออกจากระบบได้ทันที
     * (ถึงตัวเองจะยังเข้าไม่ได้เพราะไม่มี OTP ก็ตาม)
     */
    if (twoFaEnabled && hasTotp && req.preAuth.totpVerified !== true) {
      await logModel.saveLog(db, logModel.buildLogData(req, '2FA_VERIFY_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: user.username,
        remark: `${user.username} -> Tried to change password before OTP verification`
      }));

      res.send({ ok: false, error: 'กรุณายืนยันรหัส 6 หลักก่อนเปลี่ยนรหัสผ่าน' });
      return;
    }

    const check = passwordModel.checkPolicy(password, confirmPassword, user.password, user.password_algo);

    if (!check.ok) {
      res.send({ ok: false, error: check.error });
      return;
    }

    // เก็บ md5 เดิมไว้เฉพาะครั้งแรกที่ย้ายจาก md5 มา bcrypt
    const legacyMd5 = user.password_algo === 'bcrypt' ? null : user.password;

    await loginModel.changePassword(db, user.user_id, passwordModel.hash(password), legacyMd5);

    await logModel.saveLog(db, logModel.buildLogData(req, 'CHANGE_PASSWORD', {
      userId: user.user_id,
      peopleId: user.people_id,
      peopleUserId: user.people_user_id,
      username: user.username,
      remark: `${user.username} -> Password changed (md5 -> bcrypt)`
    }));

    // อ่านสถานะใหม่หลังอัปเดต เพื่อตัดสินขั้นตอนถัดไปจากข้อมูลจริง
    const updated = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);
    const forceChangeEnabled = getSetting(settings, 'SYS_FORCE_CHANGE_PASSWORD', 'N') === 'Y';
    const next = decideNextStep(updated, twoFaEnabled, forceChangeEnabled, req.preAuth.totpVerified);

    if (next === 'done') {
      const token = await completeLogin(req, db, updated, settings, null);
      res.send({ ok: true, next: 'done', token: token });
      return;
    }

    res.send({
      ok: true,
      next: next,
      preAuthToken: preAuth.sign({
        userId: updated.user_id,
        username: updated.username,
        userWarehouseId: req.preAuth.userWarehouseId,
        totpVerified: req.preAuth.totpVerified
      })
    });

  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

// ---------------------------------------------------------------------------
// ขั้นที่ 3 : ตั้งค่า Google Authenticator (ขอ QR)
// ---------------------------------------------------------------------------
router.post('/2fa/setup', checkPreAuth, wrap(async (req, res, next) => {
  const db = req.db;

  try {
    const settings = await loadSettings(db);
    const user = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);

    if (!user) {
      res.send({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้งาน' });
      return;
    }

    if (user.totp_enabled === 'Y' && user.totp_secret) {
      res.send({ ok: false, error: 'บัญชีนี้ตั้งค่าการยืนยัน 2 ขั้นตอนไว้แล้ว' });
      return;
    }

    const secret = twoFactor.generateSecret();
    const setup = await twoFactor.buildSetup(secret, user.username, getHospitalName(settings));

    await logModel.saveLog(db, logModel.buildLogData(req, '2FA_SETUP', {
      userId: user.user_id,
      peopleId: user.people_id,
      peopleUserId: user.people_user_id,
      username: user.username,
      remark: `${user.username} -> Requested 2FA QR`
    }));

    res.send({
      ok: true,
      qrDataUri: setup.qrDataUri,
      secretText: setup.secretText,
      issuer: setup.issuer,
      account: setup.account,
      // secret ยังไม่ถูกบันทึกลงฐานข้อมูล ฝากไว้ใน pre-auth token จนกว่าจะยืนยันสำเร็จ
      preAuthToken: preAuth.sign({
        userId: user.user_id,
        username: user.username,
        userWarehouseId: req.preAuth.userWarehouseId,
        pendingSecret: cryptoUtil.encrypt(secret)
      })
    });

  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

// ---------------------------------------------------------------------------
// ขั้นที่ 4 : ยืนยันการตั้งค่า 2FA ด้วยรหัส 6 หลัก
// ---------------------------------------------------------------------------
router.post('/2fa/confirm', checkPreAuth, wrap(async (req, res, next) => {
  const db = req.db;
  const code: any = req.body.code;

  try {
    if (!req.preAuth.pendingSecret) {
      res.send({ ok: false, error: 'ไม่พบข้อมูลการตั้งค่า กรุณาเริ่มขั้นตอนใหม่' });
      return;
    }

    const settings = await loadSettings(db);
    const user = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);

    if (!user) {
      res.send({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้งาน' });
      return;
    }

    /**
     * ตรวจซ้ำว่าบัญชีนี้ยังไม่ได้ตั้ง 2FA จริงๆ
     *
     * pendingSecret อยู่ใน pre-auth token ที่มีอายุ 15 นาที ถ้าระหว่างนั้นมีอีก session
     * ตั้ง 2FA สำเร็จไปแล้ว การเอา token เก่ามายืนยันจะเขียนทับ secret ที่เพิ่งตั้งไป
     * = แย่งบัญชีจากคนที่ลงทะเบียนถูกต้องได้ (แข่งกันลงทะเบียน ใครยืนยันทีหลังชนะ)
     */
    if (user.totp_enabled === 'Y' && user.totp_secret) {
      await logModel.saveLog(db, logModel.buildLogData(req, '2FA_VERIFY_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: user.username,
        remark: `${user.username} -> Stale setup token, 2FA already enabled`
      }));

      res.send({ ok: false, error: 'บัญชีนี้ตั้งค่าการยืนยัน 2 ขั้นตอนไปแล้ว กรุณาเข้าสู่ระบบใหม่' });
      return;
    }

    const secret = cryptoUtil.decrypt(req.preAuth.pendingSecret);

    if (!twoFactor.verify(secret, code)) {
      await logModel.saveLog(db, logModel.buildLogData(req, '2FA_VERIFY_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: user.username,
        remark: `${user.username} -> Invalid code during 2FA setup`
      }));

      res.send({
        ok: false,
        error: 'รหัสยืนยันไม่ถูกต้อง กรุณาตรวจสอบเวลาบนมือถือแล้วลองใหม่',
        // ส่ง token เดิมกลับไปให้ผู้ใช้ลองซ้ำได้โดยไม่ต้องสแกน QR ใหม่
        preAuthToken: preAuth.sign({
          userId: user.user_id,
          username: user.username,
          userWarehouseId: req.preAuth.userWarehouseId,
          pendingSecret: req.preAuth.pendingSecret
        })
      });
      return;
    }

    await loginModel.enableTotp(db, user.user_id, cryptoUtil.encrypt(secret));

    await logModel.saveLog(db, logModel.buildLogData(req, '2FA_CONFIRM', {
      userId: user.user_id,
      peopleId: user.people_id,
      peopleUserId: user.people_user_id,
      username: user.username,
      remark: `${user.username} -> 2FA enabled`
    }));

    const updated = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);
    const twoFaEnabled = getSetting(settings, 'SYS_2FA_ENABLE', 'N') === 'Y';
    const forceChangeEnabled = getSetting(settings, 'SYS_FORCE_CHANGE_PASSWORD', 'N') === 'Y';

    // ผ่าน 2FA มาแล้วในรอบนี้ ไม่ต้องให้กรอก OTP ซ้ำ เหลือแค่ตรวจว่าต้องเปลี่ยนรหัสไหม
    if (forceChangeEnabled && updated.must_change_password === 'Y') {
      res.send({
        ok: true,
        next: 'change_password',
        preAuthToken: preAuth.sign({
          userId: updated.user_id,
          username: updated.username,
          userWarehouseId: req.preAuth.userWarehouseId,
          totpVerified: true
        })
      });
      return;
    }

    const token = await completeLogin(req, db, updated, settings, null);
    res.send({ ok: true, next: 'done', token: token });

  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

// ---------------------------------------------------------------------------
// ขั้นที่ 5 : กรอก OTP (สำหรับผู้ใช้ที่ตั้งค่าไว้แล้ว)
// ---------------------------------------------------------------------------
router.post('/2fa/verify', checkPreAuth, wrap(async (req, res, next) => {
  const db = req.db;
  const code: any = req.body.code;

  try {
    const settings = await loadSettings(db);
    const user = await loadUser(db, req.preAuth.username, req.preAuth.userWarehouseId);

    if (!user) {
      res.send({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้งาน' });
      return;
    }

    if (user.totp_enabled !== 'Y' || !user.totp_secret) {
      res.send({ ok: false, error: 'บัญชีนี้ยังไม่ได้ตั้งค่าการยืนยัน 2 ขั้นตอน' });
      return;
    }

    if (user.locked_until && moment(user.locked_until).isAfter(moment())) {
      const minutesLeft = Math.max(1, moment(user.locked_until).diff(moment(), 'minutes'));
      res.send({
        ok: false,
        code: 'LOCKED',
        error: `บัญชีถูกระงับชั่วคราว กรุณาลองใหม่อีกครั้งใน ${minutesLeft} นาที`
      });
      return;
    }

    const maxFailed = +getSetting(settings, 'SYS_LOGIN_MAX_FAILED', '10');
    const lockMinutes = +getSetting(settings, 'SYS_LOGIN_LOCK_MINUTES', '15');
    const secret = cryptoUtil.decrypt(user.totp_secret);

    if (!twoFactor.verify(secret, code)) {
      const attempt = await loginModel.registerFailedAttempt(db, user.user_id, maxFailed, lockMinutes);

      await logModel.saveLog(db, logModel.buildLogData(req, attempt.locked ? 'ACCOUNT_LOCKED' : '2FA_VERIFY_FAIL', {
        userId: user.user_id,
        peopleId: user.people_id,
        peopleUserId: user.people_user_id,
        username: user.username,
        remark: attempt.locked
          ? `${user.username} -> Locked until ${attempt.lockedUntil}`
          : `${user.username} -> Invalid OTP (remaining ${attempt.remaining})`
      }));

      if (attempt.locked) {
        res.send({
          ok: false,
          code: 'LOCKED',
          error: `กรอกรหัสผิดเกินกำหนด บัญชีถูกระงับ ${lockMinutes} นาที`
        });
      } else {
        res.send({
          ok: false,
          error: 'รหัสยืนยันไม่ถูกต้อง',
          remainingAttempts: attempt.remaining,
          preAuthToken: preAuth.sign({
            userId: user.user_id,
            username: user.username,
            userWarehouseId: req.preAuth.userWarehouseId
          })
        });
      }
      return;
    }

    const forceChangeEnabled = getSetting(settings, 'SYS_FORCE_CHANGE_PASSWORD', 'N') === 'Y';

    if (forceChangeEnabled && user.must_change_password === 'Y') {
      await loginModel.clearFailedAttempts(db, user.user_id);
      res.send({
        ok: true,
        next: 'change_password',
        preAuthToken: preAuth.sign({
          userId: user.user_id,
          username: user.username,
          userWarehouseId: req.preAuth.userWarehouseId,
          // ผ่าน OTP แล้ว จะได้ไม่โดนถามซ้ำ และมีสิทธิ์เปลี่ยนรหัสผ่านได้
          totpVerified: true
        })
      });
      return;
    }

    const token = await completeLogin(req, db, user, settings, null);
    res.send({ ok: true, next: 'done', token: token });

  } catch (error) {
    console.log(error);
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

export default router;
