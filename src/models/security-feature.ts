import { LoginModel } from './login';

const loginModel = new LoginModel();

/**
 * ตรวจครั้งเดียวว่าฐานข้อมูลรัน SQL migration ของงาน 2FA แล้วหรือยัง แล้วจำผลไว้
 *
 * ต้องตรวจแบบ lazy ไม่ใช่ตอน boot เพราะ req.db ถูกสร้างใหม่ทุก request
 * (ดู app.ts) จึงยังไม่มี connection ให้ใช้ตอนแอปเริ่มทำงาน
 *
 * ใช้ร่วมกันระหว่าง routes/login.ts และ routes/users.ts เพื่อให้ทั้งสองฝั่ง
 * ตัดสินใจตรงกันเสมอว่าจะเขียนรหัสผ่านเป็น md5 (แบบเดิม) หรือ bcrypt (แบบใหม่)
 * ถ้าตัดสินไม่ตรงกันจะเกิดกรณีที่ผู้ใช้ถูกสร้างด้วย bcrypt แต่ login เทียบด้วย md5
 * ซึ่งทำให้เข้าระบบไม่ได้เลย
 *
 * แยกสถานะของ um_users กับ um_logs ออกจากกัน เพราะ migration อาจถูกรันไม่ครบ
 * (ALTER um_users ผ่าน แต่ ALTER um_logs ล้มเหลว)
 */

let userColumnsReady: boolean = null;
let logColumnsReady: boolean = null;

/**
 * จำผลเฉพาะเมื่อได้คำตอบที่แน่นอนเท่านั้น
 *
 * ถ้าจำค่า false ที่เกิดจาก error ชั่วคราว (เช่น connection หลุดตอนนั้นพอดี)
 * ระบบจะติดอยู่ในโหมด legacy ไปจนกว่าจะ restart แล้วเขียนรหัสผ่านเป็น md5
 * ทับแถวที่ password_algo = 'bcrypt' ทำให้เจ้าของบัญชีเข้าระบบไม่ได้ถาวร
 */
async function detect(current: boolean, check: () => Promise<boolean>, label: string): Promise<boolean> {
  // จำเฉพาะคำตอบว่า "พร้อมแล้ว" เท่านั้น
  //
  // ถ้าจำคำตอบว่า "ยังไม่พร้อม" ไว้ด้วย จะเกิดกรณีนี้: โรงพยาบาลรัน SQL migration
  // ขณะที่ service กำลังทำงานอยู่ (ไม่ได้ restart) service จะติดอยู่ในโหมดเดิมตลอดไป
  // เปิดสวิตช์ 2FA แล้วก็ไม่มีอะไรเกิดขึ้น เงียบๆ โดยไม่มี error ให้เห็นเลย
  //
  // สถานะ "ยังไม่พร้อม" เป็นสถานะชั่วคราวก่อน migration จึงยอมให้ query
  // information_schema ซ้ำได้ (query เบามาก และจะหยุดถามทันทีที่ migration เสร็จ)
  if (current === true) {
    return true;
  }

  const result = await check();

  // log เฉพาะตอนที่เพิ่งเปลี่ยนสถานะ ไม่งั้นจะรก log ทุก request ก่อน migration
  if (result || current === null) {
    console.log(result
      ? `[security] ${label}: พบคอลัมน์ครบ — ใช้ flow ใหม่`
      : `[security] ${label}: ยังไม่ได้รัน SQL migration — ใช้ flow เดิม (จะตรวจซ้ำเรื่อยๆ)`);
  }

  return result;
}

export async function isSecurityReady(knex): Promise<boolean> {
  try {
    userColumnsReady = await detect(userColumnsReady, () => loginModel.hasSecurityColumns(knex), 'um_users');
    return userColumnsReady;
  } catch (error) {
    // ไม่จำผล ให้ลองใหม่ใน request ถัดไป
    console.log('[security] ตรวจ um_users ไม่สำเร็จ ใช้ flow เดิมชั่วคราว:', error.message);
    return false;
  }
}

export async function isLogSchemaReady(knex): Promise<boolean> {
  try {
    logColumnsReady = await detect(logColumnsReady, () => loginModel.hasLogColumns(knex), 'um_logs');
    return logColumnsReady;
  } catch (error) {
    console.log('[security] ตรวจ um_logs ไม่สำเร็จ บันทึก log แบบเดิมชั่วคราว:', error.message);
    return false;
  }
}

/** ใช้ตอนทดสอบ หรือหลังรัน migration เสร็จโดยไม่อยาก restart service */
export function resetSecurityCache(): void {
  userColumnsReady = null;
  logColumnsReady = null;
}
