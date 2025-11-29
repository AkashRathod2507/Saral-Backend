import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    addresses: [
        {
            street: String,
            city: String,
            state: String,
            zip: String,
            country: String,
            type: String,
            name: String
        }
    ]
}, { timestamps: true });

export const Supplier = mongoose.model('Supplier', supplierSchema);








