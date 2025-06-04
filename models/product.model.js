const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    highlights: {
        type: [String],
        default: []
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category ID is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required']
    },
    costPrice: {
        type: Number
    },
    salePrice: {
        type: Number
    },
    onSale: {
        type: Boolean,
        default: false
    },
    stock: {
        type: Number,
        default: 0
    },
    brand: {
        type: String
    },
    petTypes: {
        type: [String],
        default: []
    },
    images: {
        type: [String],
        default: []
    },
    ratings: {
        average: {type: Number, default: 0},
        count: {type: Number, default: 0},
        totalStars: {type: Number, default: 0}
    },
    recentReviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    isVisible: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    tags: {
        type: [String],
        default: []
    },
    soldCount: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});

productSchema.index({
    name: 'text',
    description: 'text',
    highlights: 'text',
    brand: 'text',
    tags: 'text'
}, {
    weights: {
        name: 10,
        brand: 5,
        description: 3,
        highlights: 2,
        tags: 1
    }
});
productSchema.index({isActive: 1, isFeatured: 1});
productSchema.index({categoryId: 1});
productSchema.index({petTypes: 1});
productSchema.index({onSale: 1});
productSchema.index({stock: 1});

module.exports = mongoose.model('Product', productSchema);
