const express = require('express');
const validate = require('../middlewares/validate.middleware');
const productValidation = require('../validations');
const {productController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');
const {productImageUpload, reviewImageUpload} = require('../configs/multer');

const router = express.Router();

router
    .route('/')
    .get(auth, validate(productValidation.getProducts.query, 'query'), productController.getProducts)
    .post(
        auth,
        authorize('admin'),
        productImageUpload.array('images', 5),
        validate(productValidation.createProduct.body),
        productController.createProduct
    );

router
    .route('/:productId/inventory')
    .patch(auth, authorize('admin'), validate(productValidation.getProduct.params, 'params'), productController.updateProductStock);

router
    .route('/:productId/reviews')
    .get(auth, validate(productValidation.getProduct.params, 'params'), productController.getProductReviews)
    .post(
        auth,
        reviewImageUpload.array('photos'),
        validate(productValidation.createReview.body),
        validate(productValidation.getProduct.params, 'params'),
        productController.createProductReview
    );

router
    .route('/:productId')
    .get(auth, validate(productValidation.getProduct.params, 'params'), productController.getProduct)
    .patch(
        auth,
        authorize('admin'),
        productImageUpload.array('images', 5), // Allow multiple images, max 5
        validate(productValidation.updateProduct.params, 'params'),
        validate(productValidation.updateProduct.body),
        productController.updateProduct
    )
    .delete(
        auth,
        authorize('admin'),
        validate(productValidation.getProduct.params, 'params'),
        productController.deleteProduct
    );

// Analytics routes
router.get(
    '/analytics/dashboard',
    auth,
    authorize('admin', 'staff'),
    productController.getDashboardAnalytics
);

router.get(
    '/analytics/stats',
    auth,
    authorize('admin', 'staff'),
    productController.getProductStats
);

router.get(
    '/analytics/distribution',
    auth,
    authorize('admin', 'staff'),
    productController.getProductDistribution
);

router.get(
    '/analytics/best-selling',
    auth,
    authorize('admin', 'staff'),
    productController.getBestSellingProducts
);

router.get(
    '/analytics/inventory-report',
    auth,
    authorize('admin', 'staff'),
    productController.getInventoryReport
);


module.exports = router;
