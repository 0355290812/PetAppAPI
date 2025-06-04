const mongoose = require('mongoose');

const dailyAvailabilitySchema = new mongoose.Schema({
    isOpen: {
        type: Boolean,
        default: false
    },
    openTime: {
        type: String
    },
    closeTime: {
        type: String
    },
    slotDuration: {
        type: Number,
        enum: [10, 15, 20, 30, 45, 60, 90, 120],
        default: 30 // in minutes
    },
});

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Service name is required'],
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
    images: {
        type: [String],
        default: []
    },
    petTypes: {
        type: [String],
        default: []
    },
    duration: {
        type: Number,
        // required: [true, 'Duration is required']
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
        type: Number
    },
    capacity: {
        type: Number,
        default: 1
    },
    availability: {
        monday: dailyAvailabilitySchema,
        tuesday: dailyAvailabilitySchema,
        wednesday: dailyAvailabilitySchema,
        thursday: dailyAvailabilitySchema,
        friday: dailyAvailabilitySchema,
        saturday: dailyAvailabilitySchema,
        sunday: dailyAvailabilitySchema
    },
    excludedHolidays: {
        type: [Date],
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
    usageCount: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});

// Create text index with case-insensitive collation
serviceSchema.index(
    {name: 'text', description: 'text'},
    {
        weights: {name: 10, description: 5},
        default_language: 'none',
        collation: {locale: 'vn', strength: 2}  // strength: 2 makes it case-insensitive
    }
);
serviceSchema.index({isActive: 1, isFeatured: 1});
serviceSchema.index({petTypes: 1});

module.exports = mongoose.model('Service', serviceSchema);
