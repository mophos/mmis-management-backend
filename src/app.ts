'use strict';
import * as path from 'path';
let envPath = path.join(__dirname, '../../mmis-config');
require('dotenv').config(({ path: envPath }));

import * as express from 'express';
import * as favicon from 'serve-favicon';
import * as logger from 'morgan';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as _ from 'lodash';

import * as Knex from 'knex';
import { MySqlConnectionConfig } from 'knex';

import { Jwt } from './models/jwt';
const jwt = new Jwt();
const protect = require('@risingstack/protect');

import indexRoute from './routes/index';
import loginRoute from './routes/login';
import userRoute from './routes/users';
import groupRoute from './routes/groups';
import rightRoute from './routes/rights';
import peopleRoute from './routes/people';
import titleRoute from './routes/titles';
import positionRoute from './routes/positions';
import settingRoute from './routes/settings';
import logRoute from './routes/logs';
import serialRoute from './routes/serial';
import holidayRoute from './routes/holiday';
import productGroupsRoute from './routes/productGroups';
import reportRoute from './routes/report';
import approveRoute from "./routes/approve";
import warehouseRoute from './routes/warehouse'

const app: express.Express = express();

//view engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use(cors());

app.use(protect.express.xss({
  body: true,
  loggerFunction: console.error
}));

let auth = (req, res, next) => {
  let token: string = null;

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else {
    token = req.body.token;
  }

  jwt.verify(token)
    .then((decoded: any) => {
      req.decoded = decoded;
      let rights = decoded.accessRight.split(',');
      if (rights) {
        if (_.indexOf(rights, 'UM_ADMIN') > -1) {
          next();
        } else {
          res.send({ ok: false, error: 'Permission denied!' });
        }
      } else {
        res.send({ ok: false, error: 'Permission denied!' });
      }

    }, err => {
      return res.send({
        ok: false,
        error: 'No token provided.',
        code: 403
      });
    });
}

let userAuth = (req, res, next) => {
  let token: string = null;

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else {
    token = req.body.token;
  }

  jwt.verify(token)
    .then((decoded: any) => {
      req.decoded = decoded;
      next();
    }, err => {
      return res.send({
        ok: false,
        error: 'No token provided.',
        code: 403
      });
    });
}


let dbConnection: MySqlConnectionConfig = {
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
}

app.use((req, res, next) => {
  req.db = Knex({
    client: 'mysql',
    connection: dbConnection,
    pool: {
      min: 0,
      max: 7,
      create: (conn, done) => {
        conn.query('SET NAMES utf8', (err) => {
          done(err, conn);
        });
      }
    },
    debug: true,
    acquireConnectionTimeout: 5000
  });

  next();
});

app.use('/login', loginRoute);
app.use('/users', auth, userRoute);
app.use('/groups', auth, groupRoute);
app.use('/approve', auth, approveRoute);
app.use('/rights', auth, rightRoute);
app.use('/people', auth, peopleRoute);
app.use('/titles', auth, titleRoute);
app.use('/positions', auth, positionRoute);
app.use('/settings', auth, settingRoute);
app.use('/logs', auth, logRoute);
app.use('/serial', auth, serialRoute);
app.use('/holiday', auth, holidayRoute);
app.use('/product-groups', auth, productGroupsRoute);
app.use('/report', auth, reportRoute);
app.use('/warehouses', auth, warehouseRoute);

app.use('/', indexRoute);

//catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err['status'] = 404;
  next(err);
});

//error handlers

//development error handler
//will print stacktrace
if (process.env.NODE_ENV === 'development') {
  app.use((err: Error, req, res, next) => {
    res.status(err['status'] || 500);
    res.send({ ok: false, error: err.message });
  });
}

//production error handler
// no stacktrace leaked to user
app.use((err: Error, req, res, next) => {
  res.status(err['status'] || 500);
  res.send({ ok: false, error: err.message });
});

export default app;
