const {status} = require('http-status');
const jwt = require('jsonwebtoken');
const userService = require('./user.service');
const ApiError = require('../utils/ApiError');
const config = require('../configs/config');

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
    const user = await userService.getUserByEmail(email);

    if (user.isBanned) {
        throw new ApiError(status.UNAUTHORIZED, 'Your account has been banned');
    }

    if (!user || !(await userService.isPasswordMatch(user, password))) {
        throw new ApiError(status.UNAUTHORIZED, 'Incorrect email or password');
    }
    return user;
};

/**
 * Register a new user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const registerUser = async (userBody) => {
    return userService.createUser(userBody);
};

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {string} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
    const payload = {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: expires,
        type,
    };
    return jwt.sign(payload, secret);
};

/**
 * Generate auth tokens
 * @param {User} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user) => {
    const accessTokenExpires = Math.floor(Date.now() / 1000) + (config.jwt.accessExpirationMinutes * 60);
    const accessToken = generateToken(user._id, accessTokenExpires, 'access');

    const refreshTokenExpires = Math.floor(Date.now() / 1000) + (config.jwt.refreshExpirationDays * 24 * 60 * 60);
    const refreshToken = generateToken(user._id, refreshTokenExpires, 'refresh');

    // Save refresh token to user
    await userService.updateUserById(user._id, {refreshToken});

    return {
        access: {
            token: accessToken,
            expires: new Date(accessTokenExpires * 1000),
        },
        refresh: {
            token: refreshToken,
            expires: new Date(refreshTokenExpires * 1000),
        },
    };
};

/**
 * Verify token
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token, type) => {
    try {
        const payload = jwt.verify(token, config.jwt.secret);
        if (payload.type !== type) {
            throw new Error('Invalid token type');
        }
        const user = await userService.getUserById(payload.sub);
        if (!user) {
            throw new Error('User not found');
        }
        return payload;
    } catch (error) {
        throw new ApiError(status.UNAUTHORIZED, 'Token verification failed');
    }
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
    try {
        const refreshTokenPayload = await verifyToken(refreshToken, 'refresh');
        const user = await userService.getUserById(refreshTokenPayload.sub);

        if (!user || user.refreshToken !== refreshToken) {
            throw new Error('Invalid refresh token');
        }
        if (!user) {
            throw new ApiError(status.UNAUTHORIZED, 'User not found');
        }
        return generateAuthTokens(user);
    } catch (error) {
        throw new ApiError(status.UNAUTHORIZED, 'Please authenticate');
    }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
    try {
        const resetPasswordTokenPayload = await verifyToken(resetPasswordToken, 'resetPassword');
        const user = await userService.getUserById(resetPasswordTokenPayload.sub);
        if (!user) {
            throw new Error('User not found');
        }
        await userService.updateUserById(user.id, {password: newPassword});
    } catch (error) {
        throw new ApiError(status.UNAUTHORIZED, 'Password reset failed');
    }
};

// Forgot Password (Chưa làm)

module.exports = {
    loginUserWithEmailAndPassword,
    registerUser,
    generateToken,
    generateAuthTokens,
    verifyToken,
    refreshAuth,
    resetPassword,
};
