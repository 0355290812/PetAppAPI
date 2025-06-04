const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String
    },
    petTypes: {
        type: [String],
        enum: ['dog', 'cat', 'other'],
        default: []
    },
    isVisible: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

categorySchema.index({name: 'text', description: 'text'});

module.exports = mongoose.model('Category', categorySchema);
