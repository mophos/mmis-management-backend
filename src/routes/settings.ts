import * as express from 'express';
import * as moment from 'moment';
import * as path from 'path';
import * as fse from 'fs-extra';
import * as shelljs from 'shelljs';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

import { SettingModel } from '../models/setting';
const router = express.Router();

const settingModel = new SettingModel();

router.get('/', async (req, res, next) => {
  let db = req.db;
  try {
    let detail = await settingModel.getSetting(db);
    res.send({ ok: true, detail: detail[0] });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.post('/get-sys-setting', async (req, res, next) => {
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
});

router.post('/save-settings', async (req, res, next) => {
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
});

router.post('/', async (req, res, next) => {
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
});

router.get('/backup/save', async (req, res, next) => {

  let db: any = req.db;

  let dbHost = process.env.DB_HOST;
  let dbName = process.env.DB_NAME;
  let dbUser = process.env.DB_USER;
  let dbPassword = process.env.DB_PASSWORD;
  let dbPort = +process.env.DB_PORT;

  let fileName = `backup_${moment().format('YYYYMMDD-HHmmss')}_${moment().format('x')}.sql`;

  // backup path
  let BACKUP_PATH = path.join(process.env.MMIS_DATA, 'backup');
  console.log(BACKUP_PATH);

  fse.ensureDirSync(BACKUP_PATH);

  let fullBackupPath = path.join(BACKUP_PATH, fileName);

  if (!shelljs.which('mysqldump')) {
    res.send({ ok: false, error: 'Sorry, this script requires mysqldump' });
    shelljs.echo('Sorry, this script requires mysqldump');
    shelljs.exit(1);
  } else {
    shelljs.echo('Ok starting backup!');
    let cmd = `mysqldump --host=${dbHost} --port=${dbPort} --add-drop-table ${dbName} --user=${dbUser} --password=${dbPassword} > ${fullBackupPath} `

    shelljs.exec(cmd, async (code, stdout, stderr) => {
      if (code !== 0) {
        res.send({ ok: false, error: stderr });
      } else {
        let backupDate = moment().format('YYYY-MM-DD HH:mm:ss');
        let peopleUserId = req.decoded.people_user_id;
        let obj: any = {
          backup_path: fullBackupPath,
          backup_date: backupDate,
          people_user_id: peopleUserId
        };

        shelljs.echo('Success');

        await settingModel.saveBackup(db, obj);
        res.send({ ok: true });
      }
    });

  }

});

router.get('/backup/list', async (req, res, next) => {
  let db = req.db;

  try {
    let rs: any = await settingModel.getBackupList(db);
    let files = [];
    rs.forEach(v => {
      let obj: any = {};
      obj.backup_id = v.backup_id;
      obj.backup_date = moment(v.backup_date).format('YYYY-MM-DD HH:mm:ss');
      obj.backup_path = path.basename(v.backup_path);
      files.push(obj);
    });
    res.send({ ok: true, rows: files });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.get('/backup/download/:backupId', async (req, res, next) => {
  let db = req.db;
  let backupId = req.params.backupId;

  try {
    let rs: any = await settingModel.getBackupFile(db, backupId);
    if (rs.length) {
      let file = rs[0].backup_path;
      let filename = path.basename(file);
      res.download(file, filename);
    } else {
      res.send({ ok: false, error: 'ไม่พบไฟล์ที่ต้องการ' })
    }
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});

router.delete('/backup/remove/:backupId', async (req, res, next) => {
  let db = req.db;
  let backupId = req.params.backupId;

  try {
    let rs: any = await settingModel.getBackupFile(db, backupId);

    let filePath = rs[0].backup_path;
    rimraf.sync(filePath);

    await settingModel.removeBackupFile(db, backupId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }
});


export default router;
