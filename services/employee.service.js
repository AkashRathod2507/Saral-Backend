import mongoose from 'mongoose';
import { Employee } from '../models/employee.model.js';
import { Counter } from '../models/counter.model.js';
import { ApiError } from '../utils/ApiError.js';

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

export async function generateEmployeeId(organizationId) {
  const year = new Date().getFullYear();
  const key = `employee_${organizationId || 'global'}_${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const seq = String(counter.seq).padStart(4, '0');
  return `EMP-${year}-${seq}`;
}

export async function createEmployee(payload = {}) {
  const organizationId = payload.organizationId || payload.organization_id;
  if (!organizationId) {
    throw new ApiError(400, 'organizationId required');
  }

  const prepared = {
    organization_id: organizationId,
    employeeId: payload.employeeId || await generateEmployeeId(organizationId),
    fullName: payload.fullName,
    roleTitle: payload.roleTitle,
    email: payload.email,
    phone: payload.phone,
    salary: payload.salary,
    joiningDate: payload.joiningDate,
    status: payload.status,
    notes: payload.notes
  };

  return Employee.create(prepared);
}

export async function listEmployees({ organizationId, page = 1, limit = 20, filters = {} }) {
  const orgObjectId = toObjectId(organizationId);
  if (!orgObjectId) {
    throw new ApiError(400, 'Invalid organization id');
  }

  const query = { organization_id: orgObjectId, isDeleted: false };
  if (filters.status) query.status = filters.status;
  if (filters.role) query.roleTitle = filters.role;
  if (filters.search) {
    query.$or = [
      { fullName: { $regex: filters.search, $options: 'i' } },
      { employeeId: { $regex: filters.search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Employee.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Employee.countDocuments(query)
  ]);

  return { data, total, page: Number(page), limit: Number(limit) };
}

export async function getEmployeeById(id, organizationId) {
  const doc = await Employee.findOne({ _id: id, organization_id: organizationId, isDeleted: false }).lean();
  if (!doc) throw new ApiError(404, 'Employee not found');
  return doc;
}

export async function updateEmployee(id, payload, organizationId) {
  const updated = await Employee.findOneAndUpdate(
    { _id: id, organization_id: organizationId, isDeleted: false },
    { $set: payload },
    { new: true }
  ).lean();
  if (!updated) throw new ApiError(404, 'Employee not found');
  return updated;
}

export async function deleteEmployee(id, organizationId) {
  const doc = await Employee.findOneAndUpdate(
    { _id: id, organization_id: organizationId, isDeleted: false },
    { $set: { isDeleted: true, status: 'inactive' } },
    { new: true }
  ).lean();
  if (!doc) throw new ApiError(404, 'Employee not found');
  return { success: true };
}
