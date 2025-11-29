import mongoose from 'mongoose';
const { Schema } = mongoose;

const organizationSchema = new Schema({
  // This links the organization to its owner
  owner: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  business_name: { 
    type: String, 
    required: [true, 'Business name is required']
  },
  gstin: { 
    type: String, 
    uppercase: true,
    trim: true 
  },
  address: {
    street: String,
    city: String,
    state: { type: String, required: [true, 'State is required for GST'] },
    pincode: String,
    country: { type: String, default: 'India' }
  },
  // Stores GST preferences for filing automation and nudges
  gst_settings: {
    filingFrequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly'
    },
    preferredReturnType: {
      type: String,
      enum: ['GSTR-1', 'GSTR-3B', 'GSTR-9'],
      default: 'GSTR-3B'
    },
    filingDayOfMonth: {
      type: Number,
      min: 1,
      max: 28
    },
    autoReminder: {
      type: Boolean,
      default: true
    },
    lastFiledPeriod: String,
    lastFiledAt: Date,
    gstPortalUsername: String
  }
}, { timestamps: true });

export const Organization = mongoose.model('Organization', organizationSchema);