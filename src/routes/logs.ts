import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { LogModel } from '../models/logs';
const router = express.Router();

const logModel = new LogModel();

router.post('/save', wrap(async (req, res, next) => {
  let db = req.db;

  let userId: any  = req.body.userId;
  let system: any  = req.body.system;
  let action: any  = req.body.action;
  let remark: any  = req.body.remark;
  let actionTime: any  = req.body.actionItme;

  if (userId && system && action && remark && actionTime) {
    try {
      let data = {
        user_id: userId,
        system: system,
        action: action,
        remark: remark,
        action_time: actionTime
      }
      await logModel.saveLog(db, data);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์ กรุณาตรวจสอบ' });
  }

}));

router.get('/history/:userId', wrap(async (req, res, next) => {
  let db = req.db;
  let userId = req.params.userId;

  try {
    let rows = await logModel.getLog(db, userId);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
  
}));

export default router;
