/**
 * ย่อข้อมูลอุปกรณ์ให้อ่านออก
 *
 * device_info เป็น JSON ที่หน้า login ส่งมา (ngx-device-detector) — มีเฉพาะ request
 * ที่มาจากหน้า portal เท่านั้น ส่วนขั้นตอนอื่น (เปลี่ยนรหัส, 2FA) ไม่มี จึงต้อง
 * ย่อยจาก user_agent เอาเอง ไม่งั้นตารางจะเต็มไปด้วยข้อความ Mozilla/5.0 ยาวๆ
 * ที่อ่านไม่รู้เรื่องและกินพื้นที่
 *
 * ย้ายออกมาจาก routes/users.ts เพราะตอนนี้มีสองที่ใช้ (ประวัติการใช้งาน และ
 * รายการอุปกรณ์ที่จำไว้) ถ้าปล่อยให้มีสองสำเนาแล้วแก้ที่เดียว ชื่อเบราว์เซอร์
 * ในสองหน้าจะไม่ตรงกันโดยไม่มีใครสังเกต
 */
export function describeDevice(userAgent: string, deviceInfo?: string): string {
  if (deviceInfo) {
    try {
      const d = JSON.parse(deviceInfo);
      // ngx-device-detector คืนค่าเป็นตัวพิมพ์เล็ก ('unknown') ต้องเทียบแบบไม่สนตัวพิมพ์
      // ไม่งั้นจะได้ข้อความรุงรังแบบ "chrome / mac / unknown"
      const parts = [d.browser, d.os, d.device]
        .filter(v => v && String(v).toLowerCase() !== 'unknown');
      if (parts.length) {
        return parts.join(' / ');
      }
    } catch (error) {
      // device_info ถูกตัดความยาวตอนบันทึกจน JSON ไม่สมบูรณ์ได้ ให้ตกไปย่อย user_agent
    }
  }

  if (!userAgent) {
    return null;
  }

  const ua = String(userAgent);

  // เรียงลำดับสำคัญ: Edge/Opera ปลอมตัวเป็น Chrome และ Chrome ปลอมตัวเป็น Safari
  // ถ้าเช็คผิดลำดับจะได้ชื่อเบราว์เซอร์ผิดหมด
  let browser = 'ไม่ทราบ';
  if (/Edg\//.test(ua)) { browser = 'Edge'; }
  else if (/OPR\//.test(ua)) { browser = 'Opera'; }
  else if (/Firefox\//.test(ua)) { browser = 'Firefox'; }
  else if (/Chrome\//.test(ua)) { browser = 'Chrome'; }
  else if (/Safari\//.test(ua)) { browser = 'Safari'; }
  else if (/curl\//.test(ua)) { browser = 'curl'; }

  let os = '';
  if (/Windows NT/.test(ua)) { os = 'Windows'; }
  else if (/Android/.test(ua)) { os = 'Android'; }
  else if (/iPhone|iPad/.test(ua)) { os = 'iOS'; }
  else if (/Mac OS X/.test(ua)) { os = 'macOS'; }
  else if (/Linux/.test(ua)) { os = 'Linux'; }

  return os ? `${browser} / ${os}` : browser;
}
