const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required']
    },
    name: {
        type: String,
        required: [true, 'Product name is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required']
    },
    onSale: {
        type: Boolean,
        default: false
    },
    salePrice: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: 1
    },
    subtotal: {
        type: Number,
        required: [true, 'Subtotal is required']
    },
    image: {
        type: String
    }
});

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        required: [true, 'Status is required']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String
    }
});

const shippingAddressSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required']
    },
    phone: {
        type: String,
        required: [true, 'Phone is required']
    },
    streetAddress: {
        type: String,
        required: [true, 'Street address is required']
    },
    ward: {
        type: String,
        required: [true, 'Ward is required']
    },
    district: {
        type: String,
        required: [true, 'District is required']
    },
    city: {
        type: String,
        required: [true, 'City is required']
    },
    note: {
        type: String
    }
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Customer ID is required']
    },
    items: {
        type: [orderItemSchema],
        required: [true, 'Items are required']
    },
    subtotal: {
        type: Number,
        required: [true, 'Subtotal is required']
    },
    shippingFee: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: [true, 'Total amount is required']
    },
    shippingAddress: {
        type: shippingAddressSchema,
        required: [true, 'Shipping address is required']
    },
    status: {
        type: String,
        enum: ['checkout', 'pending', 'shipping', 'delivered', 'cancelled'],
        default: 'checkout'
    },
    statusHistory: {
        type: [statusHistorySchema],
        default: []
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
    cancelledBy: {
        type: String,
        enum: ['customer', 'admin'],
    },
    cancelReason: {
        type: String
        // Có thể thêm enum cho các lý do
    },
    checkoutExpiration: {
        type: Date,
        default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
}, {
    timestamps: true
});

// Pre-save hook to generate order number
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `ORD-${ (count + 1).toString().padStart(6, '0') }`;
    }
    next();
});

// Indexes for improved query performance
orderSchema.index({customerId: 1});
orderSchema.index({status: 1});
orderSchema.index({paymentStatus: 1});
orderSchema.index({createdAt: 1});
orderSchema.index({'customerInfo.phone': 1});

module.exports = mongoose.model('Order', orderSchema);
