import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler
} from '../controllers/employee.controller.js';

const router = Router();

router.use(verifyJWT);

router.route('/')
  .get(listEmployeesHandler)
  .post(createEmployeeHandler);

router.route('/:id')
  .get(getEmployeeHandler)
  .put(updateEmployeeHandler)
  .delete(deleteEmployeeHandler);

export default router;
