import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  listAttendance,
  bulkUpsertAttendance,
  updateAttendanceById,
  summarizeAttendanceByEmployee,
  summarizeAttendanceByMonth
} from '../services/attendance.service.js';

export const listAttendanceHandler = asyncHandler(async (req, res) => {
  const { date, employeeId } = req.query;
  const data = await listAttendance({
    organizationId: req.organization_id,
    date,
    employeeId
  });
  return res.status(200).json(new ApiResponse(200, data, 'Attendance records fetched'));
});

export const bulkUpsertAttendanceHandler = asyncHandler(async (req, res) => {
  const { records } = req.body;
  const data = await bulkUpsertAttendance({
    organizationId: req.organization_id,
    records
  });
  return res.status(200).json(new ApiResponse(200, data, 'Attendance saved'));
});

export const updateAttendanceHandler = asyncHandler(async (req, res) => {
  const doc = await updateAttendanceById(req.params.id, req.organization_id, req.body);
  return res.status(200).json(new ApiResponse(200, doc, 'Attendance updated'));
});

export const attendanceEmployeeSummaryHandler = asyncHandler(async (req, res) => {
  const { startDate, endDate, month } = req.query;
  const data = await summarizeAttendanceByEmployee({
    organizationId: req.organization_id,
    startDate,
    endDate,
    month
  });
  return res.status(200).json(new ApiResponse(200, data, 'Attendance summary fetched'));
});

export const attendanceMonthlySummaryHandler = asyncHandler(async (req, res) => {
  const { year, employeeId } = req.query;
  const data = await summarizeAttendanceByMonth({
    organizationId: req.organization_id,
    year,
    employeeId
  });
  return res.status(200).json(new ApiResponse(200, data, 'Monthly attendance summary fetched'));
});
