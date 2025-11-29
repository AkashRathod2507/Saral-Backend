import mongoose from 'mongoose';
const { Schema } = mongoose;

// Generic counter used for atomic sequences (per org/year/key)
const counterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
}, { timestamps: true });

export const Counter = mongoose.model('Counter', counterSchema);
