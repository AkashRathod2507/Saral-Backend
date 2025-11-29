import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { getDashboard, getDashboardTimeseries } from '../controllers/dashboard.controller.js';

const router = Router();
router.use(verifyJWT);
router.get('/', getDashboard);
router.get('/timeseries', getDashboardTimeseries);

export default router;


