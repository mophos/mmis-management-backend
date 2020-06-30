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
  let positionName: any  = req.body.positionName;
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

router.put('/', wrap(async (req, res, next) => {
  let positionId: any  = req.body.positionId;
  let positionName: any  = req.body.positionName;

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

router.post('/unactive', wrap(async (req, res, next) => {
  let db = req.db;
  let peopleId: any  = req.body.peopleId;
  try {
    await positionModel.unActive(db, peopleId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/log', wrap(async (req, res, next) => {
  let db = req.db;
  let peopleId: any  = req.query.peopleId;
  try {
    const rs = await positionModel.log(db, peopleId);
    res.send({ ok: true, rows: rs });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/user', wrap(async (req, res, next) => {
  let db = req.db;
  let data: any  = req.body.data;
  try {
    await positionModel.savePositionUser(db, data);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.put('/user', wrap(async (req, res, next) => {
  let db = req.db;
  let data: any  = req.body.data;
  try {
    await positionModel.unActive(db, data.people_id);
    await positionModel.savePositionUser(db, data);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

export default router;
