import * as crypto from 'crypto';

/**
 * เข้ารหัส/ถอดรหัสข้อมูลลับที่ต้องเก็บลงฐานข้อมูล (ใช้กับ um_users.totp_secret)
 *
 * ใช้ AES-256-GCM เพราะให้ทั้งความลับและการตรวจสอบความถูกต้อง (authenticated
 * encryption) ถ้ามีคนแก้ค่าในฐานข้อมูลตรงๆ การถอดรหัสจะ throw แทนที่จะคืนค่าขยะ
 *
 * รูปแบบที่เก็บ: <iv hex>:<authTag hex>:<ciphertext hex>
 * ความยาวรวมสำหรับ TOTP secret ปกติ ~ 130 ตัวอักษร (คอลัมน์รองรับ 255)
 */
export class CryptoUtil {

  private algorithm = 'aes-256-gcm';

  /** อ่าน key จาก env ทุกครั้งที่ใช้ เพื่อให้ error ชัดเจนตอนเรียกจริง ไม่ใช่ตอน import */
  private getKey(): Buffer {
    const hexKey = process.env.TOTP_ENC_KEY;

    if (!hexKey) {
      throw new Error('ไม่พบ TOTP_ENC_KEY ใน mmis-config');
    }

    const key = Buffer.from(hexKey, 'hex');

    if (key.length !== 32) {
      throw new Error('TOTP_ENC_KEY ต้องเป็น hex ความยาว 64 ตัวอักษร (32 ไบต์)');
    }

    return key;
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher: any = crypto.createCipheriv(this.algorithm, this.getKey(), iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final()
    ]);

    return [
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex')
    ].join(':');
  }

  decrypt(cipherText: string): string {
    const parts = (cipherText || '').split(':');

    if (parts.length !== 3) {
      throw new Error('รูปแบบข้อมูลที่เข้ารหัสไม่ถูกต้อง');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');

    const decipher: any = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

}
