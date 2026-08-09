import * as jwt from 'jsonwebtoken';

/**
 * Pre-auth token — ใบผ่านชั่วคราวระหว่างขั้นตอน login
 *
 * ออกให้หลังจากตรวจ username/password ถูกต้องแล้ว แต่ผู้ใช้ยังทำขั้นตอนบังคับ
 * (เปลี่ยนรหัสผ่าน / ตั้งค่า 2FA / กรอก OTP) ไม่ครบ จึงยังไม่ควรได้ token จริง
 *
 * จุดสำคัญของดีไซน์: เซ็นด้วย PREAUTH_SECRET_KEY ซึ่งเป็นคนละค่ากับ SECRET_KEY
 * ผลคือ backend ของอีก 6 โมดูลจะ verify token นี้ไม่ผ่านโดยอัตโนมัติ
 * ทำให้ไม่ต้องไปแก้ checkAuth ที่ copy-paste อยู่ทุก repo
 */

const PRE_AUTH_AUDIENCE = 'mmis-preauth';

// 15 นาที — เผื่อเวลาให้ผู้ใช้ที่ต้องติดตั้งแอป Google Authenticator ระหว่างขั้นตอน
const PRE_AUTH_EXPIRES = '15m';

export interface PreAuthPayload {
  userId: number;
  username: string;
  userWarehouseId: any;
  /**
   * TOTP secret ที่เข้ารหัสแล้วระหว่างรอผู้ใช้ยืนยัน
   * เก็บไว้ใน token ไม่ใช่ในฐานข้อมูล เพื่อว่าถ้าผู้ใช้ปิดหน้าจอกลางคัน
   * จะไม่มี secret ค้างที่ยืนยันไม่สำเร็จอยู่ใน um_users
   */
  pendingSecret?: string;
  /**
   * ผ่านการยืนยัน OTP แล้วในรอบการเข้าสู่ระบบนี้
   *
   * ใช้ 2 อย่าง:
   *   1. ไม่ถาม OTP ซ้ำหลังผู้ใช้เปลี่ยนรหัสผ่านเสร็จ
   *   2. กันไม่ให้เปลี่ยนรหัสผ่านก่อนพิสูจน์ตัวตนขั้นที่ 2
   *      (คนที่ขโมยรหัสผ่านไปจะได้เปลี่ยนรหัสล็อกเจ้าของบัญชีออกไม่ได้)
   *
   * ปลอดภัยเพราะ token เซ็นด้วย PREAUTH_SECRET_KEY ผู้ใช้ปลอมค่านี้เองไม่ได้
   */
  totpVerified?: boolean;
}

export class PreAuth {

  private getSecretKey(): string {
    const key = process.env.PREAUTH_SECRET_KEY;

    if (!key) {
      throw new Error('ไม่พบ PREAUTH_SECRET_KEY ใน mmis-config');
    }

    if (key === process.env.SECRET_KEY) {
      throw new Error('PREAUTH_SECRET_KEY ต้องไม่เป็นค่าเดียวกับ SECRET_KEY');
    }

    return key;
  }

  sign(payload: PreAuthPayload): string {
    return jwt.sign(payload as any, this.getSecretKey(), {
      expiresIn: PRE_AUTH_EXPIRES,
      audience: PRE_AUTH_AUDIENCE
    });
  }

  verify(token: string): Promise<PreAuthPayload> {
    return new Promise((resolve, reject) => {
      if (!token) {
        return reject(new Error('ไม่พบ token'));
      }

      jwt.verify(token, this.getSecretKey(), { audience: PRE_AUTH_AUDIENCE }, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded as any);
        }
      });
    });
  }

}

const preAuth = new PreAuth();

/**
 * Middleware สำหรับทุก endpoint ในขั้นตอน login
 * ใส่ผลลัพธ์ไว้ที่ req.preAuth (ตั้งใจไม่ใช้ req.decoded เพื่อไม่ให้สับสนกับ token จริง)
 */
export const checkPreAuth = (req, res, next) => {
  let token: string = null;

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else {
    token = req.body ? req.body.preAuthToken : null;
  }

  preAuth.verify(token)
    .then((decoded: PreAuthPayload) => {
      req.preAuth = decoded;
      next();
    })
    .catch(() => {
      res.send({
        ok: false,
        code: 'PREAUTH_EXPIRED',
        error: 'หมดเวลาดำเนินการ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
      });
    });
};

export default preAuth;
