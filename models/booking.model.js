const mongoose = require('mongoose');
const {v4: uuidv4} = require('uuid');

const bookingSchema = new mongoose.Schema({
    bookingNumber: {
        type: String,
        unique: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Customer ID is required']
    },
    petsId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: [true, 'Pet ID is required']
    }],
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'Service ID is required']
    },
    bookingDate: {
        type: Date,
        required: [true, 'Booking date is required']
    },
    timeSlot: {
        type: String,
        required: [true, 'Time slot is required']
    },
    status: {
        type: String,
        enum: ['checkout', 'completed', 'cancelled', 'booked'],
        default: 'checkout'
    },
    cancelledBy: {
        type: String,
        enum: ['customer', 'admin'],
    },
    cancellationReason: {
        type: String,
        default: null
    },
    totalAmount: {
        type: Number,
        required: [true, 'Total amount is required']
    },
    notes: {
        type: String
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'cash'],
        default: 'credit_card'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
}, {
    timestamps: true
});

bookingSchema.pre('save', async function(next) {
    if (!this.bookingNumber) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
        const uuid = uuidv4().split('-')[0].toUpperCase(); // First 8 chars of UUID

        this.bookingNumber = `BK_${ dateStr }${ timeStr }${ uuid }`;
    }
    next();
});

// Indexes for improved query performance
bookingSchema.index({customerId: 1});
bookingSchema.index({petId: 1});
bookingSchema.index({serviceId: 1});
bookingSchema.index({status: 1});
bookingSchema.index({bookingDate: 1});

module.exports = mongoose.model('Booking', bookingSchema);
