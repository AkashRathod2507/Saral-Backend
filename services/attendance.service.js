import mongoose from 'mongoose';
import { Attendance } from '../models/attendance.model.js';
import { ApiError } from '../utils/ApiError.js';

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const resolveRange = ({ startDate, endDate, month }) => {
  let start = null;
  let end = null;

  if (month) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isNaN(year) && !Number.isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
      start = new Date(year, monthIndex, 1);
      end = new Date(year, monthIndex + 1, 1);
    }
  }

  if (!start && startDate) {
    start = normalizeDate(startDate);
  }

  if (endDate) {
    const normalizedEnd = normalizeDate(endDate);
    if (normalizedEnd) {
      end = new Date(normalizedEnd);
      end.setDate(end.getDate() + 1);
    }
  }

  if (start && !end) {
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  }

  if (!start || !end) {
    const today = new Date();
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  }

  return { start, end };
};

export async function listAttendance({ organizationId, date, employeeId }) {
  const orgId = toObjectId(organizationId);
  if (!orgId) throw new ApiError(400, 'Invalid organization id');

  const query = { organization_id: orgId };
  if (date) {
    const day = normalizeDate(date);
    if (!day) throw new ApiError(400, 'Invalid date');
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    query.date = { $gte: day, $lt: next };
  }
  if (employeeId) query.employee_id = toObjectId(employeeId);

  const docs = await Attendance.find(query)
    .populate('employee_id', 'fullName employeeId roleTitle status')
    .sort({ date: -1 })
    .lean();

  return docs;
}

export async function upsertAttendanceRecord({ organizationId, employeeId, date, status, checkIn, checkOut, notes }) {
  const orgId = toObjectId(organizationId);
  const empId = toObjectId(employeeId);
  if (!orgId || !empId) throw new ApiError(400, 'Invalid identifiers');
  const day = normalizeDate(date);
  if (!day) throw new ApiError(400, 'Invalid date');

  const payload = {
    organization_id: orgId,
    employee_id: empId,
    date: day,
    status: status || 'present',
    checkIn: checkIn ? new Date(checkIn) : null,
    checkOut: checkOut ? new Date(checkOut) : null,
    notes
  };

  const doc = await Attendance.findOneAndUpdate(
    { organization_id: orgId, employee_id: empId, date: day },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return doc;
}

export async function bulkUpsertAttendance({ organizationId, records = [] }) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'records array required');
  }

  const results = [];
  for (const record of records) {
    const saved = await upsertAttendanceRecord({ organizationId, ...record });
    results.push(saved);
  }
  return results;
}

export async function updateAttendanceById(id, organizationId, payload) {
  const doc = await Attendance.findOneAndUpdate(
    { _id: id, organization_id: toObjectId(organizationId) },
    { $set: payload },
    { new: true }
  ).lean();
  if (!doc) throw new ApiError(404, 'Attendance record not found');
  return doc;
}

export async function summarizeAttendanceByEmployee({ organizationId, startDate, endDate, month }) {
  const orgId = toObjectId(organizationId);
  if (!orgId) throw new ApiError(400, 'Invalid organization id');
  const { start, end } = resolveRange({ startDate, endDate, month });

  const matchStage = {
    organization_id: orgId,
    date: { $gte: start, $lt: end }
  };

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$employee_id',
        present: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        },
        leave: {
          $sum: {
            $cond: [{ $eq: ['$status', 'leave'] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: '_id',
        as: 'employee'
      }
    },
    { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        employeeMongoId: '$_id',
        employeeId: '$employee.employeeId',
        fullName: '$employee.fullName',
        roleTitle: '$employee.roleTitle',
        status: '$employee.status',
        present: 1,
        absent: 1,
        leave: 1,
        total: 1
      }
    },
    { $sort: { fullName: 1 } }
  ];

  const totals = await Attendance.aggregate(pipeline);

  return {
    range: {
      start,
      end
    },
    totals
  };
}

export async function summarizeAttendanceByMonth({ organizationId, year, employeeId }) {
  const orgId = toObjectId(organizationId);
  if (!orgId) throw new ApiError(400, 'Invalid organization id');

  const targetYear = Number(year) || new Date().getFullYear();
  const start = new Date(targetYear, 0, 1);
  const end = new Date(targetYear + 1, 0, 1);

  const matchStage = {
    organization_id: orgId,
    date: { $gte: start, $lt: end }
  };
  if (employeeId) {
    const empId = toObjectId(employeeId);
    if (!empId) throw new ApiError(400, 'Invalid employee id');
    matchStage.employee_id = empId;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: { month: { $month: '$date' } },
        present: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        },
        leave: {
          $sum: {
            $cond: [{ $eq: ['$status', 'leave'] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1 } },
    {
      $project: {
        _id: 0,
        month: '$_id.month',
        present: 1,
        absent: 1,
        leave: 1,
        total: 1
      }
    }
  ];

  const months = await Attendance.aggregate(pipeline);

  return {
    year: targetYear,
    months
  };
}
