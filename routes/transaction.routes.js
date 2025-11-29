import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { createTransaction } from '../controllers/transaction.controller.js';
import { listTransactions } from '../controllers/transaction.controller.js';

const router = Router();
router.use(verifyJWT);
router.post('/', createTransaction);
router.get('/', listTransactions);
export default router;








