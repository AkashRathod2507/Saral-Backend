import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  listAttendanceHandler,
  bulkUpsertAttendanceHandler,
  updateAttendanceHandler,
  attendanceEmployeeSummaryHandler,
  attendanceMonthlySummaryHandler
} from '../controllers/attendance.controller.js';

const router = Router();

router.use(verifyJWT);

router.route('/')
  .get(listAttendanceHandler)
  .post(bulkUpsertAttendanceHandler);

router.get('/summary/employees', attendanceEmployeeSummaryHandler);
router.get('/summary/monthly', attendanceMonthlySummaryHandler);

router.route('/:id')
  .patch(updateAttendanceHandler);

export default router;
