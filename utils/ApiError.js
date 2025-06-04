class ApiError extends Error {
    /**
     * Create an API error
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {boolean} isOperational - Is this an operational error?
     * @param {string} stack - Error stack trace
     */
    constructor (statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

module.exports = ApiError;
