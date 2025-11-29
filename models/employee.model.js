import mongoose from 'mongoose';
const { Schema } = mongoose;

const employeeSchema = new Schema({
  organization_id: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  employeeId: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  roleTitle: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  salary: {
    type: Number,
    default: 0
  },
  joiningDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'probation'],
    default: 'active'
  },
  notes: String,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

employeeSchema.index({ organization_id: 1, employeeId: 1 }, { unique: true });

export const Employee = mongoose.model('Employee', employeeSchema);
