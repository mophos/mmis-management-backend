import Knex = require('knex');
import * as moment from 'moment';

export class WarehouseModel {

    listSearch(knex: Knex, query: any = '') {
        const _query = `%${query}%`;
        let subSql = knex('wm_his_warehouse_mappings as wm')
            .select(knex.raw(`group_concat(wm.his_warehouse)  as his_warehouse`))
            .where('wm.mmis_warehouse', 'w.warehouse_id')
            .groupBy('wm.mmis_warehouse')
        let sql =
            knex('wm_warehouses as w')
                .where('w.is_deleted', 'N')
                .where(w => {
                    w.where('w.warehouse_name', 'like', _query)
                    w.orWhere('w.short_code', 'like', _query)
                })
                .orderBy('w.is_actived', 'DESC')
                .orderBy('w.short_code', 'ASC')
        // let sql = `
        //   select w.*, t.type_name, 
        //     (
        //       select group_concat(wm.his_warehouse) 
        //       from wm_his_warehouse_mappings as wm 
        //       where wm.mmis_warehouse=w.warehouse_id 
        //       group by wm.mmis_warehouse
        //     ) as his_warehouse
        //   from wm_warehouses as w
        //   left join wm_types as t on t.type_id=w.type_id
        //   where w.is_deleted = 'N'
        //   and (w.warehouse_name like '%${query}%' or w.short_code like '%${query}%')
        //   order by w.is_actived desc,w.short_code asc
        // `;
        return sql;
    }

    save(knex: Knex, datas: any) {
        return knex('wm_warehouses')
            .insert(datas, 'warehouse_id');
    }

    saveWarehouseMapping(knex: Knex, datas: any) {
        return knex('wm_his_warehouse_mappings')
            .insert(datas);
    }

    removeWarehouseMapping(knex: Knex, mmisWarehouseId: any) {
        return knex('wm_his_warehouse_mappings')
            .where('mmis_warehouse', mmisWarehouseId)
            .del();
    }

    update(knex: Knex, warehouseId: string, datas: any) {
        return knex('wm_warehouses')
            .where('warehouse_id', warehouseId)
            .update(datas);
    }

    remove(knex: Knex, warehouseId: string) {
        return knex('wm_warehouses')
            .where('warehouse_id', warehouseId)
            .update({ 'is_deleted': 'Y', 'is_actived': 'N' });
    }

    locationList(knex: Knex, warehouseId: any) {
        return knex('wm_locations')
            .where('warehouse_id', warehouseId)
            .orderBy('location_name', 'DESC');
    }

    locationSave(knex: Knex, datas: any) {
        return knex('wm_locations')
            .insert(datas);
    }

    locationUpdate(knex: Knex, locationId: string, datas: any) {
        return knex('wm_locations')
            .where('location_id', locationId)
            .update(datas);
    }

    locationRemove(knex: Knex, locationId: string) {
        return knex('wm_locations')
            .where('location_id', locationId)
            .del();
    }
}