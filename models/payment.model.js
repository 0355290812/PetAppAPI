const mongoose = require('mongoose');
const {v4: uuidv4} = require('uuid');

const paymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true
    },
    targetType: {
        type: String,
        enum: ['order', 'booking'],
        required: [true, 'Target type is required']
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Target ID is required']
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Customer ID is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required']
    },
    method: {
        type: String,
        required: [true, 'Payment method is required'],
        enum: ['credit_card']
    },
    provider: {
        type: String,
    },
    clientSecret: {
        type: String,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Pre-save hook to generate payment number
paymentSchema.pre('save', async function(next) {
    if (!this.paymentNumber) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
        const uuid = uuidv4().split('-')[0].toUpperCase(); // First 8 chars of UUID

        this.paymentNumber = `PM_${ dateStr }${ timeStr }${ uuid }`;
    }
    next();
});

// Indexes for improved query performance
// paymentSchema.index({paymentNumber: 1});
paymentSchema.index({targetType: 1, targetId: 1});
paymentSchema.index({customerId: 1});
paymentSchema.index({status: 1});
paymentSchema.index({transactionId: 1});
paymentSchema.index({createdAt: 1});

module.exports = mongoose.model('Payment', paymentSchema);
