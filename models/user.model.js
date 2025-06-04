const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    streetAddress: {
        type: String,
        required: true,
    },
    ward: {
        type: String,
        required: true,
    },
    district: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}, {timestamps: true});

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    passwordHash: {
        type: String,
        required: true,
    },
    fullname: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['user', 'staff', 'admin'],
        default: 'user'
    },
    avatar: {
        type: String,
        default: '/uploads/users/default-avatar.png'
    },
    addresses: [addressSchema],
    refreshToken: {
        type: String,
        default: null
    },
    isBanned: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;
