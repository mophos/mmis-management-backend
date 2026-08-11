import Knex = require('knex');
import * as crypto from 'crypto';
import * as moment from 'moment';

import { describeDevice } from './device-info';

/**
 * จดจำอุปกรณ์ (Trusted Device) — ข้ามการกรอก OTP บนเครื่องที่ผู้ใช้สั่งให้จำไว้
 * อ้างอิง: PLAN-trusted-device.md
 *
 * ดีไซน์สำคัญ 2 ข้อ
 *
 * 1) cookie เก็บ "รหัสของเครื่อง" ไม่ใช่ "รหัสของผู้ใช้"
 *    ตารางเก็บคู่ (user_id, device_hash) ผู้ใช้หลายคนบนเบราว์เซอร์เดียวกัน
 *    จึงมีแถวของตัวเองแยกกัน ถ้าผูก cookie กับผู้ใช้ พอคนที่สองมาติ๊กจำอุปกรณ์
 *    cookie จะถูกเขียนทับ แล้วคนแรกจะเสียความเชื่อถือไปโดยไม่รู้สาเหตุ
 *
 * 2) เก็บเฉพาะค่าที่ผ่าน SHA-256 แล้ว ไม่เก็บ token ตัวจริง
 *    ถ้าฐานข้อมูลรั่ว ผู้ที่ได้ไปจะปลอม cookie ไม่ได้
 *    (ใช้ SHA-256 ไม่ใช่ bcrypt เพราะ token เป็นค่าสุ่ม 256 บิตอยู่แล้ว
 *     ไม่มีอะไรให้เดาแบบ dictionary attack จึงไม่ต้องการ key stretching
 *     และต้อง lookup ด้วย index ให้เร็วในทุก request ของการ login)
 */

const COOKIE_NAME = 'mmis_td';
const TOKEN_BYTES = 32;
const MAX_DEVICES_PER_USER = 3;

/**
 * เพดานจำนวนวัน กันตั้งค่าพลาดเป็น 3650 แล้วกลายเป็นปิด 2FA ถาวรโดยไม่ตั้งใจ
 * ค่าที่เกินจะถูกตัดลงมาเท่านี้ ไม่ใช่ถือว่าเป็น error
 */
const MAX_TRUST_DAYS = 30;

export class TrustedDeviceModel {

  /**
   * แปลงค่า SYS_2FA_TRUST_DEVICE_DAYS เป็นจำนวนวันที่ใช้ได้จริง
   * คืน 0 = ปิดฟีเจอร์ (ค่าเริ่มต้นของทุกโรงพยาบาล)
   */
  getTrustDays(rawValue: any): number {
    const days = parseInt(String(rawValue), 10);

    if (isNaN(days) || days <= 0) {
      return 0;
    }

    return Math.min(days, MAX_TRUST_DAYS);
  }

  /** อ่านรหัสเครื่องจาก cookie — คืน null ถ้าเบราว์เซอร์นี้ยังไม่เคยได้รับ */
  readToken(req: any): string {
    const value = req.cookies ? req.cookies[COOKIE_NAME] : null;

    // รับเฉพาะรูปแบบที่ระบบออกให้เท่านั้น กันค่าขยะที่ผู้ใช้ยัดเข้ามาเอง
    // ไปโผล่ใน query แล้วทำให้ error หรือกิน index ฟรี
    return /^[0-9a-f]{64}$/.test(String(value || '')) ? value : null;
  }

  /**
   * คืนรหัสเครื่องที่จะใช้ ถ้ายังไม่มีให้สุ่มใหม่แล้วตั้ง cookie
   *
   * ตั้ง cookie ใหม่ทุกครั้งที่เรียก เพื่อเลื่อนวันหมดอายุของ cookie ตาม
   * แถวที่เพิ่งสร้าง — ฐานข้อมูลเป็นตัวตัดสินอายุจริงเสมอ cookie เป็นแค่พาหะ
   * ถ้า cookie อยู่นานกว่าแถวก็ไม่เป็นไร เพราะ isTrusted() จะไม่เจอแถวแล้ว
   */
  ensureToken(req: any, res: any, days: number): string {
    const existing = this.readToken(req);
    const token = existing || crypto.randomBytes(TOKEN_BYTES).toString('hex');

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,     // สคริปต์ในหน้าเว็บอ่านไม่ได้ กัน XSS ขโมย token
      secure: this.useSecureCookie(req),
      sameSite: 'lax',    // ไม่ส่ง cookie ไปกับ request ที่มาจากเว็บอื่น
      path: '/',          // ให้ครอบทุกโมดูลที่อยู่คนละ path (/inventory/, /purchasing/, ...)
      maxAge: days * 24 * 60 * 60 * 1000
    });

    return token;
  }

  /**
   * ระบบจริงเป็น HTTPS จึงตั้ง Secure เสมอ ยกเว้นตอนเรียกจาก localhost
   *
   * ตรวจจาก X-Forwarded-Proto ไม่ได้ เพราะ nginx ใน container เขียนทับด้วย $scheme
   * ของตัวเอง (ฟังที่ port 80) ค่าที่ reverse-proxy ชั้นนอกส่งมาจึงหายไป
   * จึงดูจาก Host แทน — โดเมนของโรงพยาบาลไม่มีทางเป็น localhost
   *
   * ที่ต้องยกเว้น localhost เพราะเครื่อง dev รันผ่าน http ล้วน
   * เบราว์เซอร์บางตัวไม่ยอมเก็บ cookie ที่มี Secure ทำให้ทดสอบไม่ได้เลย
   *
   * ถ้ามีคนปลอม Host เป็น localhost ยิงเข้าเครื่องจริง ผลเสียตกกับตัวเองเท่านั้น
   * (ได้ cookie ที่ไม่มี Secure กลับไป) ไม่กระทบผู้ใช้คนอื่น
   */
  private useSecureCookie(req: any): boolean {
    const host = req && req.headers ? String(req.headers.host || '') : '';
    return !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  /** ล้าง cookie ทิ้ง ใช้ตอนพบว่า token ที่ถืออยู่ใช้ไม่ได้แล้ว */
  clearCookie(res: any): void {
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  /**
   * เครื่องนี้ได้รับความเชื่อถือจากผู้ใช้คนนี้อยู่หรือไม่
   *
   * เทียบทั้ง user_id และ device_hash เสมอ — นี่คือจุดที่ทำให้สเปกข้อ 1 เป็นจริง
   * คนอื่นที่ใช้เบราว์เซอร์เดียวกันจะส่ง cookie ใบเดียวกันมา แต่หาแถวของตัวเองไม่เจอ
   * จึงต้องกรอก OTP ตามปกติ
   */
  async isTrusted(knex: Knex, userId: any, token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    const now = moment().format('YYYY-MM-DD HH:mm:ss');

    const rs: any = await knex('um_trusted_devices')
      .select('trusted_id')
      .where('user_id', userId)
      .where('device_hash', this.hash(token))
      .where('expires_at', '>', now)
      .limit(1);

    if (!rs.length) {
      return false;
    }

    // บันทึกว่าใช้ล่าสุดเมื่อไร เพื่อให้ผู้ดูแลเห็นว่าเครื่องไหนยังใช้งานอยู่จริง
    // ไม่เลื่อนวันหมดอายุ เพราะสเปกข้อ 4 กำหนดให้นับแบบคงที่จากวันที่ติ๊ก
    await knex('um_trusted_devices')
      .where('trusted_id', rs[0].trusted_id)
      .update({ last_used_at: now });

    return true;
  }

  /**
   * บันทึกว่าผู้ใช้คนนี้เชื่อถือเครื่องนี้
   *
   * ถ้ามีแถวอยู่แล้ว (ติ๊กซ้ำบนเครื่องเดิม) ให้ต่ออายุออกไปใหม่แทนการเพิ่มแถว
   * ไม่งั้นจะชน unique key แล้ว login ล้มทั้งที่ผู้ใช้ทำถูกต้อง
   */
  async remember(knex: Knex, userId: any, token: string, req: any, days: number): Promise<void> {
    if (!token || days <= 0) {
      return;
    }

    const now = moment();
    const deviceHash = this.hash(token);
    const userAgent = req.headers ? req.headers['user-agent'] : null;

    const data: any = {
      device_label: this.trim(describeDevice(userAgent), 150),
      user_agent: this.trim(userAgent, 255),
      last_used_at: now.format('YYYY-MM-DD HH:mm:ss'),
      expires_at: now.clone().add(days, 'days').format('YYYY-MM-DD HH:mm:ss')
    };

    const existing: any = await knex('um_trusted_devices')
      .select('trusted_id')
      .where('user_id', userId)
      .where('device_hash', deviceHash)
      .limit(1);

    if (existing.length) {
      await knex('um_trusted_devices')
        .where('trusted_id', existing[0].trusted_id)
        .update(data);
    } else {
      data.user_id = userId;
      data.device_hash = deviceHash;
      data.created_at = now.format('YYYY-MM-DD HH:mm:ss');
      data.created_ip = this.trim(this.getIp(req), 45);

      await knex('um_trusted_devices').insert(data);
    }

    // ล้างของหมดอายุก่อนนับโควตา ไม่งั้นแถวที่ใช้ไม่ได้แล้วจะกินสิทธิ์ 3 เครื่อง
    // ทำให้ผู้ใช้เสียเครื่องที่ยังใช้งานอยู่ไปโดยไม่จำเป็น
    await this.clearExpired(knex, userId);
    await this.pruneOldest(knex, userId);
  }

  /**
   * เก็บได้ไม่เกิน MAX_DEVICES_PER_USER เครื่อง เกินแล้วลบตัวที่เก่าที่สุดออก
   * กันกรณีผู้ใช้ติ๊กทุกเครื่องที่เคยนั่งจนสะสมเป็นสิบเครื่อง
   */
  private async pruneOldest(knex: Knex, userId: any): Promise<void> {
    // เรียงตาม "ใช้ล่าสุด" ไม่ใช่ "สร้างเมื่อไร"
    //
    // ถ้าเรียงตาม created_at เครื่องที่ผู้ใช้ติ๊กซ้ำเพื่อต่ออายุจะยังนับเป็นของเก่า
    // แล้วโดนเตะออกก่อนเครื่องที่ไม่ได้แตะมานาน ทั้งที่เพิ่งยืนยันว่ายังใช้อยู่
    const rows: any = await knex('um_trusted_devices')
      .select('trusted_id')
      .where('user_id', userId)
      .orderByRaw('COALESCE(`last_used_at`, `created_at`) DESC, `trusted_id` DESC');

    if (rows.length <= MAX_DEVICES_PER_USER) {
      return;
    }

    const removeIds = rows.slice(MAX_DEVICES_PER_USER).map(r => r.trusted_id);

    await knex('um_trusted_devices')
      .whereIn('trusted_id', removeIds)
      .del();
  }

  /** เพิกถอนทุกอุปกรณ์ของผู้ใช้ — ใช้ตอนเปลี่ยนรหัสผ่าน / รีเซ็ต 2FA / ผู้ดูแลสั่ง */
  revokeAll(knex: Knex, userId: any) {
    return knex('um_trusted_devices')
      .where('user_id', userId)
      .del();
  }

  /** รายการอุปกรณ์สำหรับหน้าผู้ดูแล — ไม่คืน device_hash ออกไปเด็ดขาด */
  listByUser(knex: Knex, userId: any) {
    return knex('um_trusted_devices')
      .select('trusted_id', 'device_label', 'created_ip', 'created_at', 'last_used_at', 'expires_at')
      .where('user_id', userId)
      .orderBy('last_used_at', 'desc');
  }

  /** ล้างแถวที่หมดอายุแล้วทิ้ง — ระบุ userId เพื่อล้างเฉพาะคนนั้น */
  clearExpired(knex: Knex, userId?: any) {
    const query = knex('um_trusted_devices')
      .where('expires_at', '<=', moment().format('YYYY-MM-DD HH:mm:ss'));

    if (userId !== undefined && userId !== null) {
      query.where('user_id', userId);
    }

    return query.del();
  }

  /**
   * ตรวจว่าฐานข้อมูลสร้างตารางแล้วหรือยัง
   * ใช้กับ security-feature เพื่อให้ deploy โค้ดก่อนรัน SQL ได้โดยไม่พัง
   */
  async hasTable(knex: Knex): Promise<boolean> {
    const rs: any = await knex('information_schema.tables')
      .count('* as total')
      .where('table_schema', knex.raw('DATABASE()'))
      .where('table_name', 'um_trusted_devices');

    return rs.length > 0 && +rs[0].total === 1;
  }

  /**
   * อ่าน IP จาก X-Real-IP ที่ nginx ใส่ให้ ไม่ใช้ X-Forwarded-For
   * เพราะผู้เรียกปลอมค่านำหน้าใน XFF ได้ (เหตุผลเดียวกับใน models/logs.ts)
   */
  private getIp(req: any): string {
    const realIp = req.headers ? req.headers['x-real-ip'] : null;

    if (realIp) {
      return String(realIp).trim();
    }

    return req.connection && req.connection.remoteAddress
      ? req.connection.remoteAddress
      : null;
  }

  private trim(value: any, max: number): string {
    return value ? String(value).substring(0, max) : null;
  }
}
