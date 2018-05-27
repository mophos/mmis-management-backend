import { RightModel } from './../models/right';
import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { GroupModel } from '../models/group';
const router = express.Router();

const groupModel = new GroupModel();
const rightModel = new RightModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let rows = await groupModel.list(db);
    res.send({ ok: true, rows: rows });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let groupName = req.body.groupName;
  let db = req.db;
  if (groupName) {
    let datas: any = {
      group_name: groupName
    }
    try {
      await groupModel.save(db, datas);
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

router.put('/:groupId', wrap(async (req, res, next) => {
  let groupId = req.params.groupId;
  let groupName = req.body.groupName;

  let db = req.db;

  if (groupId) {
    let datas: any = {
      group_name: groupName
    }

    try {
      await groupModel.update(db, groupId, datas);
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

router.get('/detail/:groupId', wrap(async (req, res, next) => {
  let groupId = req.params.groupId;
  let db = req.db;
  try {
    let rows = await groupModel.detail(db, groupId);
    res.send({ ok: true, detail: rows[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message })
  } finally {
    db.destroy();
  }
}));

router.delete('/:groupId', wrap(async (req, res, next) => {
  let groupId = req.params.groupId;
  let db = req.db;

  try {
    await groupModel.remove(db, groupId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

router.get('/rights/:groupId', wrap(async (req, res, next) => {
  let groupId = req.params.groupId;
  let db = req.db;

  try {
    const rows = await groupModel.getRights(db, groupId);
    // const rights = await rightModel.all(db);
    const detail = await groupModel.detail(db, groupId);

    res.send({ ok: true, rows: rows, groupName: detail[0].group_name });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

}));

router.put('/rights/:groupId', wrap(async (req, res, next) => {
  let groupId = req.params.groupId;
  let rights = req.body.rights;
  let groupName = req.body.groupName;
  let db = req.db;

  if (groupId && rights.length) {
    let data = [];
    rights.forEach(v => {
      data.push({ group_id: groupId, right_id: v });
    });
    try {
      await groupModel.removeRights(db, groupId);
      await groupModel.saveRights(db, data);
      await groupModel.update(db, groupId, { 'group_name': groupName });
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'กรุณาระบุข้อมูลที่ต้องการบันทึก' });
  }
}));

export default router;
