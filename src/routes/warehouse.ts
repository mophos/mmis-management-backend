import * as express from 'express';
import * as moment from 'moment';
import * as wrap from 'co-express';
import * as _ from 'lodash';

import { WarehouseModel } from '../models/warehouse';
const router = express.Router();

const warehouseModel = new WarehouseModel();

//------------------------------ warehouses ------------------------------//

//getAllAndSearch
router.get('/search', wrap(async (req, res, next) => {

  let db = req.db;
  let query = req.query.query || '';
  try {
    let rs: any = await warehouseModel.listSearch(db, query);
    res.send({ ok: true, rows: rs[0] });
  } catch (error) {
    res.send({ ok: false, error: error });
  } finally {
    db.destroy();
  }
}));

//save
router.post('/', wrap(async (req, res, next) => {
  let warehouseName = req.body.warehouseName;
  let shortCode = req.body.shortCode;
  let location = req.body.location;
  let isActived = req.body.isActived;
  let isReceive = req.body.isReceive;
  let isUnitIssue = req.body.isUnitIssue;
  let hospcode = req.body.hospcode;
  let depCode = req.body.depCode;

  let db = req.db;

  if (warehouseName && hospcode && depCode) {
    let datas: any = {
      warehouse_name: warehouseName,
      short_code: shortCode,
      location: location,
      is_actived: isActived,
      is_unit_issue: isUnitIssue,
      his_hospcode: hospcode,
      // his_dep_code: depCode,
      created_at: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    try {
      let rs: any = await warehouseModel.save(db, datas);
      let warehouseId = rs[0];

      let dataWarehouse = [];

      let _depCode = [];
      if (depCode) {
        _depCode = depCode.split(',');
        _.forEach(_depCode, v => {
          let obj: any = {};
          obj.mmis_warehouse = warehouseId;
          obj.his_warehouse = _.trim(v);
          dataWarehouse.push(obj);
        })
      }

      await warehouseModel.removeWarehouseMapping(db, warehouseId);
      await warehouseModel.saveWarehouseMapping(db, dataWarehouse);

      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error }) ;
      // throw error;
    }

  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' }) ;
  }
}));

//update
router.put('/:warehouseId', wrap(async (req, res, next) => {
  let warehouseId = req.params.warehouseId;
  let warehouseName = req.body.warehouseName;
  let shortCode = req.body.shortCode;
  let location = req.body.location;
  let isActived = req.body.isActived;
  let isReceive = req.body.isReceive;
  let isUnitIssue = req.body.isUnitIssue;
  let hospcode = req.body.hospcode;
  let depCode = req.body.depCode;

  let db = req.db;

  let datas: any = {
    warehouse_name: warehouseName,
    short_code: shortCode,
    location: location,
    is_actived: isActived,
    is_unit_issue: isUnitIssue,
    his_hospcode: hospcode,
    // his_dep_code: depCode,
  }

  let dataWarehouse = [];

  let _depCode = [];
  if (depCode) {
    _depCode = depCode.split(',');
    _.forEach(_depCode, v => {
      let obj: any = {};
      obj.mmis_warehouse = warehouseId;
      obj.his_warehouse = _.trim(v);
      dataWarehouse.push(obj);
    })
  }

  if (warehouseId && warehouseName && hospcode && depCode) {
    try {
      await warehouseModel.removeWarehouseMapping(db, warehouseId);
      await warehouseModel.saveWarehouseMapping(db, dataWarehouse);
      let rs = await warehouseModel.update(db, warehouseId, datas);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error });
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' }) ;
  }
}));

//remove
router.delete('/:warehouseId', (req, res, next) => {
  let warehouseId = req.params.warehouseId;
  let db = req.db;

  warehouseModel.remove(db, warehouseId)
    .then((results: any) => {
      res.send({ ok: true });
    })
    .catch(error => {
      res.send({ ok: false, error: error.message })
    })
    .finally(() => {
      db.destroy();
    });
});

//------------------------------------------------------------------------//

//------------------------------ locations ------------------------------//

//getLocation
router.get('/getLocation/:warehouseId', wrap(async (req, res, next) => {
  let db = req.db;
  let warehouseId = req.params.warehouseId;

  try {
    const results = await warehouseModel.locationList(db, warehouseId)
    res.send({ ok: true, rows: results });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {

  }
}));

//saveLocation
router.post('/saveLocation/:warehouseId', async(req, res, next) => {
  let location = req.body.location;
  let warehouseId = req.params.warehouseId;

  let _location: any = {};
  _location.location_name = location.location_name;
  _location.location_desc = location.location_desc;
  _location.dimension_height = location.dimension_height;
  _location.dimension_length = location.dimension_length;
  _location.dimension_width = location.dimension_width;
  _location.max_items = location.max_items;
  _location.is_active = location.is_active;
  _location.warehouse_id = warehouseId;

  let db = req.db;

  if (location.location_name) {
    try {
      let rs = await warehouseModel.locationSave(db, _location);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' }) ;
  }
});

//updateLocation
router.put('/updateLocation/:locationId', async(req, res, next) => {
  let location = req.body.location;
  let _location: any = {};
  _location.location_name = location.location_name;
  _location.location_desc = location.location_desc;
  _location.dimension_height = location.dimension_height;
  _location.dimension_length = location.dimension_length;
  _location.dimension_width = location.dimension_width;
  _location.max_items = location.max_items;
  _location.is_active = location.is_active;

  let db = req.db;

  if (location.location_name) {
    try {
      let rs = await warehouseModel.locationUpdate(db, location.location_id, _location);
      res.send({ ok: true });
    } catch (error) {
      res.send({ ok: false, error: error.message });
    } finally {
      db.destroy();
    }
  } else {
    res.send({ ok: false, error: 'ข้อมูลไม่สมบูรณ์' }) ;
  }
});

//deleteLocation
router.delete('/deleteLocation/:locationId', async(req, res, next) => {
  let locationId = req.params.locationId;
  let db = req.db;

  try {
    await warehouseModel.locationRemove(db, locationId);
    res.send({ ok: true });
  } catch (error) {
    res.send({ ok: false, error: error.message });
  } finally {
    db.destroy();
  }

});

//------------------------------------------------------------------------//

export default router;
