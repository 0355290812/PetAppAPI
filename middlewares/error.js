const {status} = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Convert error to ApiError
 * @param {Error} err
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const errorConverter = (err, req, res, next) => {
    console.log(err);

    let error = err;
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || error instanceof SyntaxError
            ? status.BAD_REQUEST
            : status.INTERNAL_SERVER_ERROR;
        const message = error.message || status[statusCode];
        error = new ApiError(statusCode, message, false, err.stack);
    }
    next(error);
};

/**
 * Error handler, sends error response
 * @param {ApiError} err
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const errorHandler = (err, req, res, next) => {
    // Đảm bảo statusCode luôn là một số hợp lệ
    let statusCode = err.statusCode || status.INTERNAL_SERVER_ERROR;

    // Kiểm tra thêm để đảm bảo statusCode là một số nguyên hợp lệ
    if (typeof statusCode !== 'number' || isNaN(statusCode) || !Number.isInteger(statusCode)) {
        // console.error('Invalid status code:', statusCode);
        statusCode = status.INTERNAL_SERVER_ERROR; // Mặc định 500 nếu không hợp lệ
    }

    const {message} = err;

    const response = {
        code: statusCode,
        message,
        ...(process.env.NODE_ENV === 'development' && {stack: err.stack}),
    };

    if (process.env.NODE_ENV === 'development') {
        console.error(err);
    }

    res.status(statusCode).json(response);
};

module.exports = {
    errorConverter,
    errorHandler,
};
