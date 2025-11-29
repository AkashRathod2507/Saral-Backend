import mongoose from 'mongoose';
const { Schema } = mongoose;

const stockMovementSchema = new Schema({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  item_id: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  quantity_change: { type: Number, required: true }, // positive for add, negative for remove
  reason: { type: String, enum: ['adjustment', 'purchase', 'sale', 'correction'], default: 'adjustment' },
  notes: { type: String }
}, { timestamps: true });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);








