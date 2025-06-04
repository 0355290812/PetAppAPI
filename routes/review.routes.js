const express = require('express');
const validate = require('../middlewares/validate.middleware');
const reviewValidation = require('../validations');
const {reviewController} = require('../controllers');
const {auth} = require('../middlewares/auth.middleware');

const router = express.Router();

router
    .route('/')
    .post(auth, validate(reviewValidation.createReview.body), reviewController.createReview);

router.get('/user', auth, reviewController.getUserReviews);
router.get('/product/:productId', validate(reviewValidation.getProduct.params, 'params'), reviewController.getProductReviews);

router
    .route('/:reviewId')
    .get(validate(reviewValidation.getReview.params, 'params'), reviewController.getReview)
    .patch(
        auth,
        validate(reviewValidation.updateReview.params, 'params'),
        validate(reviewValidation.updateReview.body),
        reviewController.updateReview
    )
    .delete(auth, validate(reviewValidation.getReview.params, 'params'), reviewController.deleteReview);

module.exports = router;
