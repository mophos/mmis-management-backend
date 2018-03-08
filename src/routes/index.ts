'use strict';

import * as express from 'express';
const router = express.Router();

router.get('/',(req,res,next) => {
  res.send({ ok: true, message: 'Welcome to Users Management System', version: '0.1.1' });
});

export default router;