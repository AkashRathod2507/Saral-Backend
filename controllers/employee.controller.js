import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
} from '../services/employee.service.js';

export const createEmployeeHandler = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    organizationId: req.organization_id
  };
  const employee = await createEmployee(payload);
  return res.status(201).json(new ApiResponse(201, employee, 'Employee created'));
});

export const listEmployeesHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, role, q } = req.query;
  const result = await listEmployees({
    organizationId: req.organization_id,
    page: Number(page),
    limit: Number(limit),
    filters: { status, role, search: q }
  });
  return res.status(200).json(new ApiResponse(200, result, 'Employees fetched'));
});

export const getEmployeeHandler = asyncHandler(async (req, res) => {
  const employee = await getEmployeeById(req.params.id, req.organization_id);
  return res.status(200).json(new ApiResponse(200, employee, 'Employee fetched'));
});

export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  const employee = await updateEmployee(req.params.id, req.body, req.organization_id);
  return res.status(200).json(new ApiResponse(200, employee, 'Employee updated'));
});

export const deleteEmployeeHandler = asyncHandler(async (req, res) => {
  const result = await deleteEmployee(req.params.id, req.organization_id);
  return res.status(200).json(new ApiResponse(200, result, 'Employee removed'));
});
