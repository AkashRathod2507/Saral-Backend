import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  listReturns,
  generateReturn,
  fetchReturn,
  modifyReturnStatus,
  gstDraftPreviewHandler,
  gstTransactionSearchHandler
} from '../controllers/gst_return.controller.js';

const router = Router();

router.use(verifyJWT);

router.route('/')
  .get(listReturns);

router.route('/generate')
  .post(generateReturn);

router.get('/draft/preview', gstDraftPreviewHandler);
router.get('/transactions', gstTransactionSearchHandler);

router.route('/:id')
  .get(fetchReturn)
  .patch(modifyReturnStatus);

export default router;
