const Joi = require('joi');
const {status} = require('http-status');
const ApiError = require('../utils/ApiError');

/**
 * Centralized validation middleware
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {

        const {error} = schema.validate(req[property], {abortEarly: false});

        if (!error) return next();

        const errorMessage = error.details
            .map((detail) => detail.message)
            .join(', ');
        next(new ApiError(status.BAD_REQUEST, errorMessage));
    };
};

module.exports = validate;
