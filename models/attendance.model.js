import mongoose from 'mongoose';
const { Schema } = mongoose;

const attendanceSchema = new Schema({
  organization_id: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  employee_id: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'leave'],
    default: 'present'
  },
  checkIn: Date,
  checkOut: Date,
  notes: String
}, { timestamps: true });

attendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
