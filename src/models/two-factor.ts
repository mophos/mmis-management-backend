const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

/**
 * การยืนยันตัวตน 2 ขั้นตอนด้วย TOTP (Google Authenticator)
 *
 * ค่าที่ใช้เป็นค่ามาตรฐานที่ Google Authenticator รองรับ: 6 หลัก / 30 วินาที / SHA-1
 * window = 1 หมายถึงยอมรับรหัสของช่วงก่อนหน้าและถัดไปอย่างละ 1 ช่วง (คลาดได้ ±30 วินาที)
 * เผื่อนาฬิกามือถือกับเซิร์ฟเวอร์ไม่ตรงกันเล็กน้อย
 */
const TOTP_WINDOW = 1;
const SECRET_LENGTH = 20;

export interface TwoFactorSetup {
  /** เก็บลงฐานข้อมูล (ต้องเข้ารหัสด้วย CryptoUtil ก่อน) */
  secret: string;
  /** แสดงให้ผู้ใช้กรอกเองกรณีสแกน QR ไม่ได้ */
  secretText: string;
  /** รูป QR เป็น data URI ส่งให้ frontend ใส่ใน <img> ได้ทันที */
  qrDataUri: string;
  issuer: string;
  account: string;
}

export class TwoFactorModel {

  /**
   * ชื่อที่จะโชว์ในแอป Google Authenticator
   * ใส่ชื่อโรงพยาบาลไว้ด้วยเพราะเจ้าหน้าที่บางคนใช้หลายระบบ จะได้แยกออก
   */
  buildIssuer(hospitalName: string): string {
    return hospitalName ? `MMIS (${hospitalName})` : 'MMIS';
  }

  generateSecret(): string {
    return speakeasy.generateSecret({ length: SECRET_LENGTH }).base32;
  }

  /** จัดกลุ่มทีละ 4 ตัวให้ผู้ใช้อ่านและพิมพ์ตามได้ง่าย */
  formatSecretForDisplay(secret: string): string {
    return (secret.match(/.{1,4}/g) || []).join(' ');
  }

  async buildSetup(secret: string, username: string, hospitalName: string): Promise<TwoFactorSetup> {
    const issuer = this.buildIssuer(hospitalName);

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      encoding: 'base32',
      label: `${issuer}:${username}`,
      issuer: issuer
    });

    const qrDataUri = await qrcode.toDataURL(otpauthUrl);

    return {
      secret: secret,
      secretText: this.formatSecretForDisplay(secret),
      qrDataUri: qrDataUri,
      issuer: issuer,
      account: username
    };
  }

  verify(secret: string, token: string): boolean {
    if (!secret || !token) {
      return false;
    }

    // ผู้ใช้มักพิมพ์เว้นวรรคตามที่แอปแสดง (เช่น "123 456") ตัดออกก่อนตรวจ
    const cleaned = String(token).replace(/\s/g, '');

    if (!/^[0-9]{6}$/.test(cleaned)) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: cleaned,
      window: TOTP_WINDOW
    });
  }

}
