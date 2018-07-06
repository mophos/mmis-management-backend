import * as express from 'express';
import * as wrap from 'co-express';
import { reportModel } from '../models/report';
const router = express.Router();

const model = new reportModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rsH = await model.getHeader(db);
    for (const v of rsH) {
      let rsD = await model.getDetail(db, v.report_id);
      v.details = rsD;
    }
    res.send({ ok: true, rows: rsH });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.put('/disactive/:reportId', wrap(async (req, res, next) => {
  let reportId = req.params.reportId;
  let db = req.db;

  try {
    await model.setDisActive(db, reportId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));


router.put('/active/:reportId/:reportDetailId', wrap(async (req, res, next) => {
  let reportId = req.params.reportId;
  let reportDetailId = req.params.reportDetailId;
  let db = req.db;

  try {
    await model.setDisActive(db, reportId);
    await model.setActive(db, reportDetailId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

export default router;