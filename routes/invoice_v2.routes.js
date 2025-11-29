import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { listInvoicesV2 } from '../controllers/invoice_v2.controller.js';

const router = Router();
router.use(verifyJWT);
router.get('/', listInvoicesV2);
export default router;








