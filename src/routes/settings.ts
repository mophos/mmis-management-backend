import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';

import { SettingModel } from '../models/setting';
const router = express.Router();

const settingModel = new SettingModel();

router.get('/', wrap(async (req, res, next) => {
  let db = req.db;
  try {
    let detail = await settingModel.getSetting(db);
    res.send({ ok: true, detail: detail[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
}));

router.post('/get-sys-setting', wrap(async (req, res, next) => {
  let actionName = req.body.actionName;
  let hospcode = req.body.hospcode;

  let db = req.db;

  settingModel.getSysSetting(db, actionName)
    .then((results: any) => {
      console.log('get sys_setting: ' + actionName + ' founded ' + results.length + 'rows');
      res.send({ ok: true, rows: results });
    })
    .catch(error => {
      console.log('get sys_setting: ' + actionName + ' fail ');
      res.send({ ok: false, error: error })
    });
}));

router.post('/save-settings', wrap(async (req, res, next) => {
  let varName = req.body.varName;
  let dataValue = req.body.dataValue;
  let hospcode = req.body.hospcode;

  let db = req.db;

  settingModel.saveSysSettings(db, varName, dataValue)
    .then((results: any) => {
      console.log('save sys_setting: ' + varName + '=' + dataValue + ' success ');
      res.send({ ok: true, rows: results });
    })
    .catch(error => {
      console.log('save sys_setting: ' + varName + '=' + dataValue + ' fail ');
      res.send({ ok: false, error: error })
    });
}));

router.post('/', wrap(async (req, res, next) => {
  let data = req.body.data;
  let hospcode = data.hospcode;
  let hospname = data.hospname;
  let address = data.address;
  let fax = data.fax;
  let telephone = data.telephone;
  let taxId = data.taxId;
  let managerName = data.managerName;

  let db = req.db;

  if (hospcode && hospname && address && managerName) {
    let datas: any = {
      hospcode: hospcode,
      hospname: hospname,
      address: address,
      fax: fax,
      telephone: telephone,
      tax_id: taxId,
      manager_name: managerName
    }

    try {
      await settingModel.saveSysSettings(db, 'SYS_HOSPITAL', JSON.stringify(data));
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

export default router;
