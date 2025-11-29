import mongoose from 'mongoose';
const { Schema } = mongoose;

const itemSchema = new Schema({
  organization_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  item_type: { 
    type: String, 
    enum: ['product', 'service'], 
    required: true 
  },
  unit_price: { 
    type: Number, 
    required: true 
  },
  stock_quantity: {
    type: Number,
    required: true,
    default: 0
  },
  hsn_sac_code: { 
    type: String 
  },
  tax_rate: { 
    type: Number, 
    required: true, 
    default: 0 
  }, // e.g., 18
}, { timestamps: true });

export const Item = mongoose.model('Item', itemSchema);