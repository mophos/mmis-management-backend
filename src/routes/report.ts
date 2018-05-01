import { RightModel } from './../models/right';
import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { GroupModel } from '../models/group';
import { reportModel } from '../models/report';
import { error } from 'util';
const router = express.Router();

const model = new reportModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await model.getList(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.put('/active/:id/:active/:type', wrap(async (req, res, next) => {
  let active = req.params.active;
  let id = req.params.id;
  let type = req.params.type;
  let db = req.db;
  try {
    await model.updateActive(db, id, active, type);
    await model.updateN(db, id, type);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/purchase-order/1', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    res.render('purchasing16');
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/purchase-order/2', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    res.render('purchase_order');
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

export default router;