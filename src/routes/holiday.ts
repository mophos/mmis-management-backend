import { HolidayModel } from './../models/holiday';
import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

const router = express.Router();

const holidayModel = new HolidayModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await holidayModel.getholidays(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));
router.get('/type', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await holidayModel.getType(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));
router.put('/active/:id/:active', wrap(async (req, res, next) => {
  let active = req.params.active;
  let id = req.params.id;
  let db = req.db;
  try {
    await holidayModel.updateActive(db,id,active);
    res.send({ ok: true});
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));
router.put('/', wrap(async (req, res, next) => {
  let data: any  = req.body.data;
  let id: any  = req.body.id;
  let db = req.db;
  try {
    await holidayModel.updateHoliday(db,id,data);
    res.send({ ok: true});
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));
router.post('/', wrap(async (req, res, next) => {
  let data: any  = req.body.data;
  let db = req.db;

    try {
      await holidayModel.add(db, data);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message })
    } finally {
      db.destroy();
    }
}));
router.delete('/', wrap(async (req, res, next) => {
  let id: any  = req.query.id;
  let db = req.db;

    try {
      await holidayModel.deleteHoliday(db, id);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message })
    } finally {
      db.destroy();
    }
}));



export default router;
