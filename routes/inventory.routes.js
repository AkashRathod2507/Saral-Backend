import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { adjustStock, getInventory, getMovements, uploadInventoryCSV } from '../controllers/inventory.controller.js';

const router = Router();

router.use(verifyJWT);

router.get('/', getInventory);
router.post('/adjust', adjustStock);
router.get('/movements', getMovements);
router.post('/upload-csv', uploadInventoryCSV);

export default router;








