import { LogModel } from './../models/logs';
import * as express from 'express';
import * as wrap from 'co-express';
import * as moment from 'moment';
import * as crypto from 'crypto';
import * as _ from 'lodash';

import { Jwt } from '../models/jwt';

import { LoginModel } from '../models/login';

const loginModel = new LoginModel();
const logModel = new LogModel();

const jwt = new Jwt();

const router = express.Router();

router.post('/genpass', wrap(async (req, res, next) => {
  let password = req.body.password || '123456';
  let encPassword = crypto.createHash('md5').update(password).digest('hex');
  res.send({ password: password, hash: encPassword });
}));

router.get('/warehouse/search', wrap(async (req, res, next) => {
  let db = req.db;
  let username = req.query.username;
  let rs = await loginModel.warehouseSearch(db, username);
  if (rs.length) {
    res.send({ ok: true, rows: rs });
  } else {
    res.send({ ok: false });
  }
}));

router.post('/', wrap(async (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;
  let userWarehouseId = req.body.userWarehouseId;
  let deviceInfo = req.body.deviceInfo;
  let db = req.db;

  if (username && password && userWarehouseId) {
    // get user detail
    try {
      let encPassword = crypto.createHash('md5').update(password).digest('hex');
      const settings = await loginModel.getSystemSetting(db);
      const expired: any = _.filter(settings, { 'action_name': 'WM_EXPIRED_YEAR_FORMAT' });
      const sysHospital: any = _.filter(settings, { 'action_name': 'SYS_HOSPITAL' });

      const hospcode = JSON.parse(sysHospital[0].action_value).hospcode;
      console.log(hospcode);
      deviceInfo.hospcode = hospcode;
      await loginModel.saveLog(deviceInfo);
      let user: any = await loginModel.doLogin(db, username, encPassword, userWarehouseId);
      console.log(user[0]);

      if (user.length) {
        const payload = {
          fullname: user[0].fullname,
          id: user[0].user_id,
          accessRight: user[0].access_right,
          people_user_id: user[0].people_user_id,
          people_id: user[0].people_id,
          warehouseId: user[0].warehouse_id,
          warehouseCode: user[0].warehouse_code,
          warehouseName: user[0].warehouse_name,
          his_hospcode: user[0].his_hospcode,
          // his_dep_code: user[0].his_dep_code,
          generic_type_id: user[0].generic_type_id,
          expired: expired.length ? expired[0].action_value == '1' ? 'BE' : 'BC' : 'BC',

        };

        settings.forEach(v => {
          payload[v.action_name] = v.action_value;
        });

        const token = jwt.sign(payload);
        let logData = {
          user_id: user[0].user_id,
          system: 'UM',
          action: 'LOGIN',
          people_user_id: user[0].people_user_id,
          remark: `${username} -> Success`,
          action_time: moment().format('x')
        }
        // save log data
        await logModel.saveLog(db, logData);
        res.send({ ok: true, token: token });
      } else {
        let logData = {
          system: 'UM',
          action: 'LOGIN',
          remark: `${username} -> Incorrect username or password`,
          action_time: moment().format('x')
        }
        // save log data
        await logModel.saveLog(db, logData);
        res.send({ ok: false, error: 'ชื่อผู้ใช้งาน/รหัสผ่านไม่ถูกต้อง' });
      }
    } catch (error) {
      console.log(error);
      res.send({ ok: false, error: error.message })
    } finally {
      db.destroy();
    }

  } else {
    res.send({ ok: false, error: 'กรุณาระบุชื่อผู้ใช้งาน,รหัสผ่านและคลัง' });
  }
}));

export default router;
