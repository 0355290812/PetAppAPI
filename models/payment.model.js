const mongoose = require('mongoose');

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
        const count = await mongoose.model('Payment').countDocuments();
        this.paymentNumber = `PMT-${ (count + 1).toString().padStart(6, '0') }`;
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
