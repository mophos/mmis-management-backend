import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { SerialModel } from '../models/serial';
const router = express.Router();

const serialModel = new SerialModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  let warehouseId = req.decoded.warehouseId;
  let year: any  = req.query.year;
  try {
    let rows = await serialModel.getSerial(db, year, warehouseId);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/format', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await serialModel.getSerialFormat(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/info/:type', wrap(async (req, res, next) => {
  let type = req.params.type;
  let db = req.db;
  try {
    let rows = await serialModel.getSerialInfo(db, type);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.put('/:type', wrap(async (req, res, next) => {
  let type = req.params.type;
  let formatId: any  = req.body.formatId;
  let runningNumber: any  = req.body.runningNumber;
  let year: any  = req.body.year;
  let warehouseId: any  = req.body.warehouseId;
  let db = req.db;
  if (type && formatId) {
    try {
      await serialModel.updateSerial(db, type, formatId, runningNumber, year, warehouseId);
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

export default router;
