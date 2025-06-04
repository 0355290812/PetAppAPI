const {status} = require('http-status');
const jwt = require('jsonwebtoken');
const config = require('../configs/config');
const {userService} = require('../services');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

const auth = catchAsync(async (req, res, next) => {
    // Check for auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ApiError(status.UNAUTHORIZED, 'Please authenticate');
    }

    // Extract and verify token
    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, config.jwt.secret);
        const user = await userService.getUserById(payload.sub);
        if (!user) {
            throw new ApiError(status.UNAUTHORIZED, 'User not found');
        }

        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(status.UNAUTHORIZED, 'Please authenticate');
    }
});

const authorize = (...roles) => {
    return (req, res, next) => {

        if (!req.user) {
            throw new ApiError(status.UNAUTHORIZED, 'Please authenticate');
        }
        if (!roles.includes(req.user.role)) {
            throw new ApiError(status.FORBIDDEN, 'Insufficient permissions');
        }
        next();
    };
};

module.exports = {
    auth,
    authorize,
};
