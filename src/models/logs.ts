import Knex = require('knex');
import * as moment from 'moment';
import { isLogSchemaReady } from './security-feature';

/** คอลัมน์ที่เพิ่มโดย SQL migration ของงาน 2FA — จะมีก็ต่อเมื่อรัน migration แล้ว */
const EXTENDED_COLUMNS = ['username', 'ip_address', 'user_agent', 'device_info', 'created_at'];

/**
 * ประวัติการเข้าใช้งานระบบ (um_logs)
 *
 * action ที่ใช้อยู่:
 *   LOGIN            เข้าสู่ระบบสำเร็จ (ผ่านทุกขั้นตอนแล้ว)
 *   LOGIN_PENDING    รหัสผ่านถูกต้อง แต่ยังต้องทำขั้นตอนต่อ (เปลี่ยนรหัส / 2FA)
 *   LOGIN_FAIL       ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
 *   ACCOUNT_LOCKED   กรอกผิดครบเกณฑ์จนถูกล็อกบัญชี
 *   CHANGE_PASSWORD  เปลี่ยนรหัสผ่าน (ทั้งแบบบังคับและแบบ admin สั่ง)
 *   2FA_SETUP        ขอ QR เพื่อตั้งค่า 2FA
 *   2FA_CONFIRM      ยืนยันการตั้งค่า 2FA สำเร็จ
 *   2FA_VERIFY_FAIL  กรอก OTP ไม่ถูกต้อง
 *   2FA_RESET        admin ล้างค่า 2FA ให้ผู้ใช้
 *   ACCOUNT_UNLOCK   admin ปลดล็อกบัญชี
 */
export class LogModel {

  /**
   * บันทึก log โดยตัดคอลัมน์ที่ยังไม่มีในฐานข้อมูลออกก่อนเสมอ
   *
   * โรงพยาบาลที่ยังไม่ได้รัน SQL migration จะไม่มีคอลัมน์ ip_address/user_agent/...
   * ถ้า insert ตรงๆ จะได้ ER_BAD_FIELD_ERROR แล้ว throw ออกไปทำให้ login ล้มทั้งระบบ
   * ซึ่งขัดกับข้อตกลงว่ายังไม่รัน SQL ต้องทำงานแบบเดิม 100%
   */
  async saveLog(knex: Knex, logs: any) {
    const data = Object.assign({}, logs);

    // ตรวจคอลัมน์ของ um_logs โดยตรง ไม่ใช่ของ um_users
    // เพราะ migration อาจถูกรันไม่ครบ แล้ว INSERT พังจนล้มการเข้าสู่ระบบทั้งหมด
    if (!await isLogSchemaReady(knex)) {
      EXTENDED_COLUMNS.forEach(column => delete data[column]);
    }

    return knex('um_logs').insert(data);
  }

  /**
   * ประกอบข้อมูล log จาก request โดยตรง
   *
   * ตารางเดิมไม่มี ip/user_agent และเคส login ไม่ผ่านจะไม่มี user_id ทำให้
   * ตรวจสอบย้อนหลังไม่ได้เลยว่าใครพยายามเข้าจากที่ไหน จึงเก็บ username แยกไว้ด้วย
   *
   * action_time คงรูปแบบเดิม (epoch millisecond เป็น string) เพื่อไม่ให้หน้าจอ
   * และรายงานที่อ่านคอลัมน์นี้อยู่แล้วพัง ส่วน created_at เป็นคอลัมน์ใหม่ที่ query ง่ายกว่า
   */
  buildLogData(req: any, action: string, options: any = {}) {
    const deviceInfo = options.deviceInfo;

    return {
      user_id: options.userId || null,
      people_id: options.peopleId || null,
      people_user_id: options.peopleUserId || null,
      // ตัดความยาวเหมือนฟิลด์อื่น เพราะ username ที่ log ตอน login ไม่ผ่าน
      // มาจาก request body โดยตรง ยาวเท่าไรก็ได้ ถ้าเกิน varchar(50) จะได้
      // ER_DATA_TOO_LONG แล้วข้อความ "รหัสผ่านไม่ถูกต้อง" กลายเป็น error ดิบแทน
      username: options.username ? String(options.username).substring(0, 50) : null,
      system: 'UM',
      action: action,
      // ตัดความยาวเหมือนฟิลด์อื่น เพราะ remark ประกอบจาก username ที่มาจาก request body
      // ตรงๆ (เช่น `${username} -> Incorrect username or password`) ถ้า username ยาวผิดปกติ
      // จะเกิน varchar(500) แล้วได้ ER_DATA_TOO_LONG แทนข้อความ error ปกติ
      remark: options.remark ? String(options.remark).substring(0, 500) : null,
      action_time: moment().format('x'),
      created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      ip_address: this.getClientIp(req),
      user_agent: (req.headers && req.headers['user-agent'])
        ? String(req.headers['user-agent']).substring(0, 255)
        : null,
      device_info: deviceInfo
        ? JSON.stringify(deviceInfo).substring(0, 500)
        : null
    };
  }

  /**
   * IP ของผู้ใช้จริง เมื่ออยู่หลัง nginx reverse proxy
   *
   * ใช้ X-Real-IP เป็นหลัก เพราะ nginx ตั้งเป็น $remote_addr = IP ที่ต่อเข้ามาจริง
   * ผู้ใช้ปลอมไม่ได้ (nginx เขียนทับค่าที่ client ส่งมาเสมอ)
   *
   * **ไม่ใช้ X-Forwarded-For เลย** เพราะ nginx ตั้งด้วย $proxy_add_x_forwarded_for
   * ซึ่งเอาค่าที่ client ส่งมาขึ้นต้นแล้วต่อท้ายด้วย IP จริง ผู้ใช้จึงยัดค่าปลอมเข้ามาได้
   * ทำให้ IP ใน log ตรวจสอบย้อนหลังเชื่อถือไม่ได้ ซึ่งอันตรายกว่าไม่มีข้อมูลเลย
   *
   * X-Real-IP ปลอดภัยเพราะ nginx เขียนทับด้วย $remote_addr เสมอ ค่าที่ client
   * ส่งมาเองจะถูกทิ้ง และ backend เปิดเฉพาะภายในคอนเทนเนอร์ (nginx เท่านั้นที่ต่อถึง)
   *
   * ถ้าไม่มี X-Real-IP (เช่นตอน dev ที่ไม่ได้ผ่าน nginx) ใช้ IP ของ socket
   * ซึ่งเป็นค่าที่ปลอมไม่ได้
   */
  getClientIp(req: any): string {
    if (!req) {
      return null;
    }

    const headers = req.headers || {};
    const realIp = headers['x-real-ip'];

    if (realIp) {
      return String(realIp).trim().substring(0, 45);
    }

    const ip = req.ip || (req.connection ? req.connection.remoteAddress : null);

    return ip ? String(ip).substring(0, 45) : null;
  }

  getLog(knex: Knex, userId: any) {
    return knex('um_logs')
      .where({ user_id: userId })
      .limit(100);
  }
}
