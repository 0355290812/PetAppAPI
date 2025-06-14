const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {orderService, paymentService} = require('../services');
const ApiError = require('../utils/ApiError');

const createOrder = catchAsync(async (req, res) => {

    const statusOrder = req.body.paymentMethod === 'credit_card' ? 'checkout' : 'pending';
    const order = await orderService.createOrder({...req.body, customerId: req.user._id, status: statusOrder});
    if (!order) {
        throw new ApiError(status.BAD_REQUEST, 'Order creation failed');
    }

    // If payment method is credit card, create payment record
    if (req.body.paymentMethod === 'credit_card') {
        const payment = await paymentService.createPayment({
            targetType: 'order',
            targetId: order._id,
            customerId: req.user._id,
            amount: order.totalAmount,
            method: req.body.paymentMethod,
            provider: 'stripe',
            status: 'pending',
        });
        order.paymentId = payment._id;
        order.paymentMethod = req.body.paymentMethod;
        await order.save();

        res.status(status.CREATED).send({
            order,
            payment
        });
        return
    }

    res.status(status.CREATED).send({order});
});

const getOrders = catchAsync(async (req, res) => {
    // Admin endpoint that allows filtering
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const {
        status: statusOrder,
        search,
        customerId,
        paymentMethod,
        startDate,
        endDate
    } = req.query;

    const filter = {
        ...(statusOrder ? {
            $and: [
                {status: statusOrder},
                {status: {$ne: 'checkout'}}
            ]
        } : {
            status: {$ne: 'checkout'}
        }),
        ...(search && {
            $or: [
                {items: {$elemMatch: {name: {$regex: search, $options: 'i'}}}},
                {orderNumber: {$regex: search, $options: 'i'}}
            ]
        }),
        ...(customerId && {customerId}),
        ...(paymentMethod && {paymentMethod}),
        ...(startDate && {createdAt: {$gte: new Date(startDate)}}),
        ...(endDate && {createdAt: {$lte: new Date(endDate)}}),
    };

    const options = {
        sortBy: req.query.sortBy,
        limit: parseInt(req.query.limit, 10) || 20,
        page: parseInt(req.query.page, 10) || 1
    };

    const result = await orderService.queryOrders(filter, options);
    res.send(result);
});

const getUserOrders = catchAsync(async (req, res) => {
    const options = {
        sortBy: req.query.sortBy || '-createdAt',
        limit: parseInt(req.query.limit, 10) || 20,
        page: parseInt(req.query.page, 10) || 1,
        status: req.query.status
    };

    const result = await orderService.getUserOrders(req.user._id, options);
    res.send(result);
});

const getOrder = catchAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    if (req.user.role === 'user' && order.customerId._id.toString() !== req.user._id.toString()) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    res.send(order);
});

const updateOrder = catchAsync(async (req, res) => {
    const order = await orderService.updateOrderById(req.params.orderId, req.body);
    res.send(order);
});

const cancelOrder = catchAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.orderId);

    // Check if the user is authorized to cancel this order
    if (req.user.role === 'user' && order.customerId._id.toString() !== req.user._id.toString()) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    // Users can only cancel pending orders
    if (req.user.role === 'user' && order.status !== 'checkout' && order.status !== 'pending') {
        throw new ApiError(status.BAD_REQUEST, 'Only pending orders can be cancelled');
    }
    if (order.status === 'checkout') {
        res.status(200).send({
            message: 'Order is waiting for payment',
        });
        return
    }

    const cancelledBy = req.user.role === 'user' ? 'customer' : 'admin';

    const cancelReason = req.body?.cancelReason ? req.body?.cancelReason : 'Khác';
    await orderService.cancelOrder(req.params.orderId, cancelReason, cancelledBy);
    res.status(status.NO_CONTENT).send();
});

// Process order payment
const processPayment = catchAsync(async (req, res) => {
    const {orderId, paymentMethod, paymentDetails} = req.body;

    const order = await orderService.getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Ensure users can only pay for their own orders
    if (order.customerId.toString() !== req.user._id) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    // Process the payment
    const updatedOrder = await orderService.processOrderPayment(orderId, paymentMethod, paymentDetails);

    // If payment method is credit card, create payment record
    if (paymentMethod === 'credit_card' && paymentDetails) {
        await paymentService.createPayment({
            targetType: 'order',
            targetId: order._id,
            customerId: req.user._id,
            amount: order.totalAmount,
            method: paymentMethod,
            status: paymentDetails.status || 'pending',
            transactionId: paymentDetails.transactionId
        });
    }

    res.send(updatedOrder);
});

const confirmOrderDelivery = catchAsync(async (req, res) => {
    const order = await orderService.confirmOrderDelivery(req.params.orderId, req.user._id);
    res.send(order);
});

const getOrderAnalytics = catchAsync(async (req, res) => {
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const {period, year, month, day} = req.query;
    const analytics = await orderService.getOrderAnalytics(period, year, month, day);

    res.send({
        success: true,
        data: analytics
    });
});

module.exports = {
    createOrder,
    getOrders,
    getUserOrders,
    getOrder,
    updateOrder,
    cancelOrder,
    processPayment,
    confirmOrderDelivery,
    getOrderAnalytics
};
