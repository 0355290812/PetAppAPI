const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    content: {
        type: String,
        required: [true, 'Reply content is required']
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Staff ID is required']
    },
    staffName: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const reviewSchema = new mongoose.Schema({
    targetType: {
        type: String,
        enum: ['product', 'service'],
        required: [true, 'Target type is required']
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Target ID is required']
    },
    sourceType: {
        type: String,
        enum: ['order', 'booking'],
        required: [true, 'Source type is required']
    },
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Source ID is required'],
        refPath: 'sourceType'
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Customer ID is required']
    },
    customerName: {
        type: String,
        // required: [true, 'Customer name is required']
    },
    customerAvatar: {
        type: String
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5
    },
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    photos: {
        type: [String],
        default: []
    },
    reply: {
        type: replySchema
    },
}, {
    timestamps: true
});

// Indexes for improved query performance
reviewSchema.index({targetType: 1, targetId: 1});
reviewSchema.index({customerId: 1});
reviewSchema.index({rating: 1});
reviewSchema.index({isVisible: 1});

module.exports = mongoose.model('Review', reviewSchema);
