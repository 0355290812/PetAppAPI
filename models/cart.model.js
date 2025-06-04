const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    // Tham chiếu đến người dùng sở hữu giỏ hàng
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true  // Mỗi người dùng chỉ có một giỏ hàng
    },

    // Danh sách các sản phẩm trong giỏ hàng
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        price: {
            type: Number,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        image: {
            type: String
        }
    }],

    // Tổng tiền của giỏ hàng
    totalAmount: {
        type: Number,
        default: 0
    },

    // Thời gian cập nhật
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware tự động tính tổng tiền trước khi lưu
cartSchema.pre('save', function(next) {
    this.totalAmount = this.items.reduce(
        (total, item) => total + (item.price * item.quantity),
        0
    );
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Cart', cartSchema);