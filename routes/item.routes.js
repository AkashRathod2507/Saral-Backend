import { Router } from 'express';
import {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem
} from '../controllers/item.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// --- ALL ITEM ROUTES ARE SECURED ---
router.use(verifyJWT);

// Routes for /api/v1/items
router.route("/")
  .post(createItem)
  .get(getAllItems);

// Routes for /api/v1/items/:id
router.route("/:id")
  .get(getItemById)
  .patch(updateItem) // PATCH is standard for updates
  .delete(deleteItem);

export default router;