import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { PeopleModel } from '../models/people';
const router = express.Router();

const peopleModel = new PeopleModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await peopleModel.all(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/titles', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await peopleModel.getTitles(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/positions', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await peopleModel.getPositions(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let data = req.body.data;
  let db = req.db;

  if (data.fname && data.lname && data.titleId && data.positionId) {
    let datas: any = {
      fname: data.fname,
      lname: data.lname,
      title_id: data.titleId,
      position_id: data.positionId
    }
    try {
      await peopleModel.save(db, datas);
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

router.put('/:peopleId', wrap(async (req, res, next) => {
  let peopleId = req.params.peopleId;
  let data = req.body.data;

  let db = req.db;

  if (peopleId && data.fname && data.lname && data.titleId && data.positionId) {
    let datas: any = {
      fname: data.fname,
      lname: data.lname,
      title_id: data.titleId,
      position_id: data.positionId
    }

    try {
      await peopleModel.update(db, peopleId, datas);
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

// router.get('/detail/:peopleId', wrap(async (req, res, next) => {
//   let peopleId = req.params.peopleId;
//   let db = req.db;
//   try {
//     let rows = await peopleModel.detail(db, peopleId);
//     res.send({ ok: true, detail: rows[0] });
//   } catch (error) {
//     res.send({ ok: false, error: error.message })
//   } finally {
//     db.destroy();
//   }
// }));

router.delete('/:peopleId', wrap(async (req, res, next) => {
  let peopleId = req.params.peopleId;
  let db = req.db;

  try {
    await peopleModel.remove(db, peopleId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

export default router;
