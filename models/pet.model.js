const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const petSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    species: {
        type: String,
        required: true,
        enum: ['Dog', 'Cat', 'Other'],
        default: 'Other'
    },
    breed: {
        type: String,
        trim: true
    },
    birthDate: {
        type: Date,
        required: true
    },
    weight: {
        type: Number,
        min: 0
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Unknown'],
        default: 'Unknown'
    },
    color: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: '/uploads/pets/dog-default-avatar.avif'
    },
    healthRecords: [{
        title: {
            type: String,
            required: true,
            trim: true
        },
        symptoms: {
            type: String,
            trim: true
        },
        diagnosis: {
            type: String,
            trim: true
        },
        treatment: {
            type: String,
            trim: true
        },
        date: {
            type: Date,
            required: true
        },
        medications: [{
            name: {
                type: String,
                required: true,
                trim: true
            },
            dosage: {
                type: String,
                required: true,
                trim: true
            },
            frequency: {
                type: String,
                required: true,
                trim: true
            },
            startDate: {
                type: Date,
                required: true
            },
            endDate: {
                type: Date
            },
        }],
        notes: {
            type: String,
            trim: true
        },
        attachments: [{
            type: String,
            trim: true
        }],
        followUp: {
            required: {
                type: Boolean,
                default: false
            },
            date: {
                type: Date
            }
        },
        relatedServiceId: {
            type: Schema.Types.ObjectId,
            ref: 'Service'
        },
    }],
    dietInfo: {
        foodType: {
            type: String,
            trim: true
        },
        schedule: {
            type: String,
            trim: true
        },
        allergies: [String],
        notes: {
            type: String,
            trim: true
        }
    },
    vaccinations: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: ['Core', 'Non-Core'],
            default: 'Core'
        },
        dateAdministered: {
            type: Date,
            required: true
        },
        expirationDate: {
            type: Date
        },
        provider: {
            type: String,
            trim: true
        },
        notes: {
            type: String,
            trim: true
        },
    }]
}, {
    timestamps: true
});

const Pet = mongoose.model('Pet', petSchema);

module.exports = Pet;
