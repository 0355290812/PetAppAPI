const express = require('express');
const validate = require('../middlewares/validate.middleware');
const orderValidation = require('../validations');
const {orderController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');

const router = express.Router();

// Add analytics endpoint
router.get('/analytics',
    auth,
    authorize('admin', 'staff'),
    validate(orderValidation.getOrderAnalytics.query, 'query'),
    orderController.getOrderAnalytics
);

router
    .route('/')
    .get(auth, authorize('admin', 'staff'), validate(orderValidation.getOrders.query, 'query'), orderController.getOrders)
    .post(auth, validate(orderValidation.createOrder.body), orderController.createOrder);

router.get('/my-orders', auth, validate(orderValidation.getUserOrders.query, 'query'), orderController.getUserOrders);

// Process payment for order
// router.post('/payment', auth, validate(orderValidation.processPayment.body), orderController.processPayment);

router
    .route('/:orderId')
    .get(auth, validate(orderValidation.getOrder.params, 'params'), orderController.getOrder)
    .patch(
        auth,
        authorize('admin', 'staff'),
        validate(orderValidation.updateOrderStatus.params, 'params'),
        validate(orderValidation.updateOrderStatus.body),
        orderController.updateOrder
    );

router.post('/:orderId/cancel',
    auth,
    validate(orderValidation.getOrder.params, 'params'),
    validate(orderValidation.cancelOrder.body),
    orderController.cancelOrder
);

// Add a new endpoint for users to confirm order delivery
router.post('/:orderId/confirm-delivery',
    auth,
    validate(orderValidation.confirmOrderDelivery.params, 'params'),
    orderController.confirmOrderDelivery
);

module.exports = router;
