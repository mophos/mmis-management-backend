import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { RightModel } from '../models/right';
const router = express.Router();

const rightModel = new RightModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await rightModel.all(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let rightName = req.body.rightName;
  let rightCode = req.body.rightCode;
  let db = req.db;

  if (rightName && rightCode) {
    let datas: any = {
      right_name: rightName,
      right_code: rightCode
    }
    try {
      await rightModel.save(db, datas);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message })
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' });
  }
}));

router.put('/:rightId', wrap(async (req, res, next) => {
  let rightId = req.params.rightId;
  let rightName = req.body.rightName;
  let rightCode = req.body.rightCode;

  let db = req.db;

  if (rightId) {
    let datas: any = {
      right_name: rightName,
      right_code: rightCode
    }

    try {
      await rightModel.update(db, rightId, datas);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }

  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' });
  }
}));

router.get('/detail/:rightId', wrap(async (req, res, next) => {
  let rightId = req.params.rightId;
  let db = req.db;
  try {
    let rows = await rightModel.detail(db, rightId);
    res.send({ ok: true, detail: rows[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message })
  } finally {
    db.destroy();
  }
}));

router.delete('/:rightId', wrap(async (req, res, next) => {
  let rightId = req.params.rightId;
  let db = req.db;

  try {
    await rightModel.remove(db, rightId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

export default router;
