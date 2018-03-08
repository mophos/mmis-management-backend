import Knex = require('knex');

export class SettingModel {
  getSetting(knex: Knex) {
    return knex('settings').limit(1);
  }

  getSysSetting(knex: Knex, actionName) {
    if (actionName === '') {
      return knex('sys_settings as s')
        .select('s.*')   
        .where('s.form_edit', '=', '1')
        .orderBy('s.action_name');
    } else {
      return knex('sys_settings')
        .where('action_name','=',actionName)
        .limit(1);
    }
  }

  save(knex: Knex, datas: any) {
    return knex('settings')
      .insert(datas);
  }

  saveSysSettings(knex: Knex, varName, dataValue) {
    const data = {
      value: dataValue
    };

    return knex('sys_settings')
      .update(data)
      .where('action_name','=',varName);
  }

  remove(knex: Knex) {
    return knex('settings')
      .del();
  }

}
