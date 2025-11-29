import { Router } from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} from '../controllers/customer.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// --- ALL CUSTOMER ROUTES ARE SECURED ---
router.use(verifyJWT);

// Routes for /api/v1/customers
router.route("/")
  .post(createCustomer)
  .get(getAllCustomers);

// Routes for /api/v1/customers/:id
router.route("/:id")
  .get(getCustomerById)
  .patch(updateCustomer) // PATCH is standard for updates
  .delete(deleteCustomer);

export default router;