import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { PositionModel } from '../models/position';
const router = express.Router();

const positionModel = new PositionModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await positionModel.all(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let positionName = req.body.positionName;
  let db = req.db;

  if (positionName) {
    let datas: any = {
      position_name: positionName,
    }
    try {
      await positionModel.save(db, datas);
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

router.put('/:positionId', wrap(async (req, res, next) => {
  let positionId = req.params.positionId;
  let positionName = req.body.positionName;

  let db = req.db;

  if (positionId && positionName) {
    let datas: any = {
      position_name: positionName
    }

    try {
      await positionModel.update(db, positionId, datas);
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

router.delete('/:positionId', wrap(async (req, res, next) => {
  let positionId = req.params.positionId;
  let db = req.db;

  try {
    await positionModel.remove(db, positionId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

export default router;
