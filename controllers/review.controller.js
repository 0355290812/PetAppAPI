const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {reviewService} = require('../services');
const ApiError = require('../utils/ApiError');

const createReview = catchAsync(async (req, res) => {
    const review = await reviewService.createReview({
        ...req.body,
        userId: req.user.id
    });
    res.status(status.CREATED).send(review);
});

const getProductReviews = catchAsync(async (req, res) => {
    const reviews = await reviewService.getProductReviews(req.params.productId);
    res.send(reviews);
});

const getUserReviews = catchAsync(async (req, res) => {
    const reviews = await reviewService.getUserReviews(req.user.id);
    res.send(reviews);
});

const getReview = catchAsync(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.reviewId);
    if (!review) {
        throw new ApiError(status.NOT_FOUND, 'Review not found');
    }
    res.send(review);
});

const updateReview = catchAsync(async (req, res) => {
    const review = await reviewService.updateReviewById(
        req.params.reviewId,
        req.body,
        req.user.id
    );
    res.send(review);
});

const deleteReview = catchAsync(async (req, res) => {
    await reviewService.deleteReviewById(req.params.reviewId, req.user.id);
    res.status(status.NO_CONTENT).send();
});

module.exports = {
    createReview,
    getProductReviews,
    getUserReviews,
    getReview,
    updateReview,
    deleteReview,
};
