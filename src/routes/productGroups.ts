import { RightModel } from './../models/right';
import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { GroupModel } from '../models/group';
import { ProductGroupModel } from '../models/productGroups';
const router = express.Router();

const productGroupModel = new ProductGroupModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await productGroupModel.getList(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

export default router;
