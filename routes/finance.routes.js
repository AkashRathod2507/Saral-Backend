import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { getBankInterestRates } from '../controllers/finance.controller.js';

const router = Router();
router.use(verifyJWT);
router.get('/rates', getBankInterestRates);

export default router;
