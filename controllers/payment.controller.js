const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {paymentService} = require('../services');
const ApiError = require('../utils/ApiError');

const createPaymentIntent = catchAsync(async (req, res) => {
    const {orderId, paymentMethod} = req.body;
    const paymentIntent = await paymentService.createPaymentIntent(orderId, paymentMethod, req.user.id);
    res.send(paymentIntent);
});

const confirmPayment = catchAsync(async (req, res) => {
    const {clientSecret} = req.body;
    const payment = await paymentService.confirmPayment(clientSecret, req.user._id);
    res.send(payment);
});

const cancelPayment = catchAsync(async (req, res) => {
    const {clientSecret} = req.body;
    await paymentService.cancelPayment(clientSecret, req.user.id);
    res.status(status.NO_CONTENT).send();
});

const getUserPayments = catchAsync(async (req, res) => {
    const payments = await paymentService.getUserPayments(req.user.id);
    res.send(payments);
});

const getPayment = catchAsync(async (req, res) => {
    const payment = await paymentService.getPaymentById(req.params.paymentId);
    if (!payment || payment.userId !== req.user.id) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }
    res.send(payment);
});

module.exports = {
    createPaymentIntent,
    confirmPayment,
    cancelPayment,
    getUserPayments,
    getPayment,
};
