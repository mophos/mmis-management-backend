import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { ApproveModel } from '../models/approve';
const router = express.Router();

const approveModel = new ApproveModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await approveModel.getLits(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));


router.get('/getUser', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await approveModel.getUser(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/getSysModule', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await approveModel.getSysModule(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.get('/autocomplete', async (req, res, next) => {
  let db = req.db;
  let q: any  = req.query.q;  
  try {
    let rs: any = await approveModel.autoComplete(db,q);    
    res.send(rs);
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

router.post('/save', wrap(async (req, res, next) => {
  let data: any  = req.body.data;
  let db = req.db;
  let people_id = req.decoded.people_id;
  
  if (data.module_id && data.action_name && data.password && data.user_id && people_id) {
    let datas: any = {
      module_id: data.module_id,
      action_name: data.action_name,
      password: data.password,
      user_id: data.user_id,
      people_id:people_id
    }
    try {
      await approveModel.save(db, datas);
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

router.put('/update', wrap(async (req, res, next) => {
  let data: any  = req.body.data;
  let people_id = req.decoded.people_id;
  let db = req.db;

  if (data.action_name && data.user_id && data.module_id &&people_id && data.password) {
    let datas: any = {
      module_id: data.module_id,
      action_name: data.action_name,
      password: data.password,
      user_id: data.user_id,
      people_id:people_id
    }
    try {
      await approveModel.update(db, datas);
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

router.delete('/remove/:user_id/:action_name', wrap(async (req, res, next) => {
  let user_id = req.params.user_id;
  let action_name = req.params.action_name;
  let db = req.db;
  let datas= {
    user_id:user_id,
    action_name:action_name
  }
  try {
    await approveModel.remove(db, datas);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

export default router;
