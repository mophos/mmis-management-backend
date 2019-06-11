import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { PeopleModel } from '../models/people';
import { PositionModel } from '../models/position';
const router = express.Router();

const peopleModel = new PeopleModel();
const positionModel = new PositionModel();

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

router.get('/autocomplete', wrap(async (req, res, next) => {
  let db = req.db;
  let query = req.query.q;
  try {
    let rows = await peopleModel.autocomplete(db, query);
    console.log(rows.length);

    if (rows.length) {
      res.send(rows);
    } else {
      res.send([]);
    }
  } catch (error) {
    res.send([]);
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

  if (data.fname && data.lname && data.titleId) {
    let datas: any = {
      fname: data.fname,
      lname: data.lname,
      title_id: data.titleId
    }
    try {
      const peopleId = await peopleModel.save(db, datas);
      console.log(peopleId);

      if (data.position_id != null) {
        let dataPosition: any = {
          people_id: peopleId[0],
          position_id: data.position_id,
        }
        await positionModel.savePositionUser(db, dataPosition);
      }
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
