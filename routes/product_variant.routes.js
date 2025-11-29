import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { adjustVariantStock, listVariants } from '../controllers/product_variant.controller.js';

const router = Router();

router.use(verifyJWT);

router.get('/', listVariants);
router.post('/adjust', adjustVariantStock);

export default router;








