const {status} = require('http-status');
const Review = require('../models/review.model');
const Product = require('../models/product.model');
const Service = require('../models/service.model');
const ApiError = require('../utils/ApiError');

/**
 * Create a review
 * @param {Object} reviewBody
 * @returns {Promise<Review>}
 */
const createReview = async (reviewBody) => {
    const review = await Review.create(reviewBody);

    // Update the product or service rating
    await updateTargetRatings(reviewBody.targetType, reviewBody.targetId);

    return review;
};

/**
 * Get review by id
 * @param {ObjectId} id
 * @returns {Promise<Review>}
 */
const getReviewById = async (id) => {
    return Review.findById(id);
};

/**
 * Get reviews by target (product/service)
 * @param {string} targetType - 'product' or 'service'
 * @param {ObjectId} targetId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing reviews and pagination info
 */
const getReviewsByTarget = async (targetType, targetId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {
        targetType,
        targetId,
        isVisible: true
    };

    // Add rating filter if provided
    if (options.rating) {
        filter.rating = options.rating;
    }

    const reviews = await Review.find(filter)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit);

    const totalResults = await Review.countDocuments(filter);

    return {
        results: reviews,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Get reviews by customer id
 * @param {ObjectId} customerId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing reviews and pagination info
 */
const getReviewsByCustomerId = async (customerId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {customerId};

    // Apply target type filter if provided
    if (options.targetType) {
        filter.targetType = options.targetType;
    }

    const reviews = await Review.find(filter)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit);

    const totalResults = await Review.countDocuments(filter);

    return {
        results: reviews,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Update review by id
 * @param {ObjectId} reviewId
 * @param {Object} updateBody
 * @returns {Promise<Review>}
 */
const updateReviewById = async (reviewId, updateBody) => {
    const review = await getReviewById(reviewId);
    if (!review) {
        throw new ApiError(status.NOT_FOUND, 'Review not found');
    }

    // Check if user is allowed to update (needs to be implemented based on your auth system)
    // Only allow updating content, title, photos
    const allowedUpdates = ['title', 'content', 'photos'];
    Object.keys(updateBody).forEach(key => {
        if (allowedUpdates.includes(key)) {
            review[key] = updateBody[key];
        }
    });

    await review.save();
    return review;
};

/**
 * Delete review by id
 * @param {ObjectId} reviewId
 * @returns {Promise<Review>}
 */
const deleteReviewById = async (reviewId) => {
    const review = await getReviewById(reviewId);
    if (!review) {
        throw new ApiError(status.NOT_FOUND, 'Review not found');
    }

    const {targetType, targetId} = review;

    await review.deleteOne();

    // Update the target's ratings after deletion
    await updateTargetRatings(targetType, targetId);

    return review;
};

/**
 * Add reply to review
 * @param {ObjectId} reviewId
 * @param {Object} replyData
 * @returns {Promise<Review>}
 */
const addReplyToReview = async (reviewId, replyData) => {
    const review = await getReviewById(reviewId);
    if (!review) {
        throw new ApiError(status.NOT_FOUND, 'Review not found');
    }

    review.reply = replyData;
    await review.save();
    return review;
};

/**
 * Toggle review visibility
 * @param {ObjectId} reviewId
 * @returns {Promise<Review>}
 */
const toggleReviewVisibility = async (reviewId) => {
    const review = await getReviewById(reviewId);
    if (!review) {
        throw new ApiError(status.NOT_FOUND, 'Review not found');
    }

    review.isVisible = !review.isVisible;
    await review.save();

    // Update target ratings if visibility changes
    await updateTargetRatings(review.targetType, review.targetId);

    return review;
};

/**
 * Update target (product/service) ratings
 * @param {string} targetType - 'product' or 'service'
 * @param {ObjectId} targetId
 * @returns {Promise<void>}
 */
const updateTargetRatings = async (targetType, targetId) => {
    // Get all visible reviews for the target
    const reviews = await Review.find({
        targetType,
        targetId,
        isVisible: true
    });

    let targetModel;
    if (targetType === 'product') {
        targetModel = Product;
    } else if (targetType === 'service') {
        targetModel = Service;
    } else {
        throw new ApiError(status.BAD_REQUEST, 'Invalid target type');
    }

    const target = await targetModel.findById(targetId);
    if (!target) {
        throw new ApiError(status.NOT_FOUND, 'Target not found');
    }

    // Calculate average rating
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
        target.ratings.average = 0;
        target.ratings.count = 0;
    } else {
        const sumRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
        target.ratings.average = sumRatings / totalReviews;
        target.ratings.count = totalReviews;
    }

    // Store the most recent reviews (limit to 3)
    target.recentReviews = reviews
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .map(review => review._id);

    await target.save();
};

module.exports = {
    createReview,
    getReviewById,
    getReviewsByTarget,
    getReviewsByCustomerId,
    updateReviewById,
    deleteReviewById,
    addReplyToReview,
    toggleReviewVisibility,
    updateTargetRatings
};
