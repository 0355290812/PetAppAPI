const express = require('express');
const validate = require('../middlewares/validate.middleware');
const paymentValidation = require('../validations').paymentValidation;
const {paymentController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');

const router = express.Router();

router
    .route('/')
    .get(auth, paymentController.getUserPayments)
    .post(auth, validate(paymentValidation.createPaymentIntent.body), paymentController.createPaymentIntent);

router.post('/confirm', auth, validate(paymentValidation.confirmPayment.body), paymentController.confirmPayment);
router.post('/cancel', auth, validate(paymentValidation.cancelPayment.body), paymentController.cancelPayment);

router
    .route('/:paymentId')
    .get(auth, validate(paymentValidation.getPayment.params, 'params'), paymentController.getPayment);

module.exports = router;
