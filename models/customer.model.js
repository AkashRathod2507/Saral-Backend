import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
    organization_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true,
        required: false
    },
    gstin: {
        type: String,
        uppercase: true,
        trim: true,
        sparse: true
    },
    gst_registration_type: {
        type: String,
        enum: ['regular', 'composition', 'unregistered', 'consumer', 'overseas', 'sez', 'deemed'],
        default: 'regular'
    },
    place_of_supply: {
        type: String,
        trim: true
    },
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        trim: true
    },
    state_code: {
        type: String,
        trim: true
    },
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

export const Customer = mongoose.model("Customer", customerSchema);