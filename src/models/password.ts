import * as crypto from 'crypto';

const bcrypt = require('bcryptjs');

const BCRYPT_COST = 10;
const MIN_LENGTH = 8;

export interface PasswordCheckResult {
  ok: boolean;
  error?: string;
}

/**
 * จัดการรหัสผ่านช่วงเปลี่ยนผ่านจาก MD5 -> bcrypt
 *
 * ระบบเดิมเก็บรหัสผ่านเป็น MD5 ไม่มี salt ระหว่างที่ผู้ใช้ยังทยอยเปลี่ยนรหัส
 * ฐานข้อมูลจะมีทั้งสองแบบปนกัน จึงใช้คอลัมน์ um_users.password_algo เป็นตัวบอกว่า
 * แถวนั้นเก็บด้วยวิธีไหน แล้วเลือกวิธีเทียบให้ตรงกัน
 */
export class PasswordModel {

  /** ใช้เฉพาะกับรหัสผ่านเดิมที่ยังเป็น md5 เท่านั้น ห้ามใช้กับรหัสใหม่ */
  md5(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex');
  }

  hash(password: string): string {
    return bcrypt.hashSync(password, BCRYPT_COST);
  }

  /**
   * เทียบรหัสผ่านโดยดูจาก algo ที่บันทึกไว้ในแถวนั้น
   * แถวที่ยังไม่เคยเปลี่ยนรหัสจะไม่มีค่า password_algo (NULL) ให้ถือว่าเป็น md5
   */
  verify(plainPassword: string, storedPassword: string, algo: string): boolean {
    if (!plainPassword || !storedPassword) {
      return false;
    }

    if (algo === 'bcrypt') {
      try {
        return bcrypt.compareSync(plainPassword, storedPassword);
      } catch (error) {
        return false;
      }
    }

    return this.md5(plainPassword) === storedPassword;
  }

  /**
   * ตรวจนโยบายรหัสผ่านใหม่ตามที่ตกลงไว้:
   * อย่างน้อย 8 ตัวอักษร, ต้องมีตัวอักษรภาษาอังกฤษและตัวเลข, ห้ามซ้ำรหัสปัจจุบัน
   *
   * คืน error เป็นข้อความภาษาไทยพร้อมแสดงผลได้เลย เพื่อให้ frontend ทั้ง 7 โมดูล
   * ไม่ต้องเขียนข้อความเองให้ต่างกัน
   */
  checkPolicy(password: string, confirmPassword: string,
              currentPassword: string, currentAlgo: string): PasswordCheckResult {

    if (!password || !confirmPassword) {
      return { ok: false, error: 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน' };
    }

    if (password !== confirmPassword) {
      return { ok: false, error: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' };
    }

    if (password.length < MIN_LENGTH) {
      return { ok: false, error: `รหัสผ่านต้องมีความยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร` };
    }

    if (!/[a-zA-Z]/.test(password)) {
      return { ok: false, error: 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว' };
    }

    if (!/[0-9]/.test(password)) {
      return { ok: false, error: 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว' };
    }

    if (this.verify(password, currentPassword, currentAlgo)) {
      return { ok: false, error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' };
    }

    return { ok: true };
  }

}
