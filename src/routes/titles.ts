import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { TitleModel } from '../models/title';
const router = express.Router();

const titleModel = new TitleModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await titleModel.all(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let titleName: any  = req.body.titleName;
  let db = req.db;

  if (titleName) {
    let datas: any = {
      title_name: titleName,
    }
    try {
      await titleModel.save(db, datas);
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

router.put('/:titleId', wrap(async (req, res, next) => {
  let titleId = req.params.titleId;
  let titleName: any  = req.body.titleName;

  let db = req.db;

  if (titleId && titleName) {
    let datas: any = {
      title_name: titleName
    }

    try {
      await titleModel.update(db, titleId, datas);
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

router.delete('/:titleId', wrap(async (req, res, next) => {
  let titleId = req.params.titleId;
  let db = req.db;

  try {
    await titleModel.remove(db, titleId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

export default router;
