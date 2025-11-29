import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { createPayment, getPayments } from '../controllers/payment.controller.js';

const router = Router();

router.use(verifyJWT);

router.route('/')
  .get(getPayments)
  .post(createPayment);

export default router;








