const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    fileUrl: {
        type: String,
        required: [true, 'File URL is required'],
    },
    fileName: {
        type: String,
        required: [true, 'File name is required'],
    },
    fileType: {
        type: String,
        required: [true, 'File type is required'],
        enum: ['pdf', 'txt'],
    },
    docIds: {
        type: [String],
        required: [true, 'Document IDs are required'],
    },
}, {
    timestamps: true,
});

documentSchema.index({fileName: 'text'});

module.exports = mongoose.model('Document', documentSchema);