const {status} = require('http-status');
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const Booking = require('../models/booking.model');
const ApiError = require('../utils/ApiError');
const config = require('../configs/config');
const Stripe = require('stripe');
const stripe = new Stripe(config.stripe.secretKey);

/**
 * Create a payment
 * @param {Object} paymentBody
 * @returns {Promise<Payment>}
 */
const createPayment = async (paymentBody) => {
    const payment = await Payment.create(paymentBody);
    if (!payment) {
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Payment creation failed');
    }

    let payload = {
        amount: paymentBody.amount,
        currency: paymentBody.currency || 'vnd',
        description: paymentBody.description || `Payment for ${ paymentBody.targetType } ${ paymentBody.targetId }`,
        metadata: {
            targetType: paymentBody.targetType,
            targetId: paymentBody.targetId.toString(),
            customerId: paymentBody.customerId.toString(),
            paymentId: payment._id.toString()
        }
    };

    const paymentIntent = await stripe.paymentIntents.create(payload);
    if (!paymentIntent) {
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Payment intent creation failed');
    }

    payment.clientSecret = paymentIntent.client_secret;
    payment.provider = 'stripe';
    await payment.save();
    return payment;
};

/**
 * Get payment by id
 * @param {ObjectId} id
 * @returns {Promise<Payment>}
 */
const getPaymentById = async (id) => {
    return Payment.findById(id);
};

/**
 * Get payment by payment number
 * @param {string} paymentNumber
 * @returns {Promise<Payment>}
 */
const getPaymentByNumber = async (paymentNumber) => {
    return Payment.findOne({paymentNumber});
};

/**
 * Get payment by client secret
 * @param {string} clientSecret
 * @returns {Promise<Payment>}
 */
const getPaymentByClientSecret = async (clientSecret) => {
    return Payment.findOne({clientSecret});
};

/**
 * Get payments by target (order/booking)
 * @param {string} targetType - 'order' or 'booking'
 * @param {ObjectId} targetId
 * @returns {Promise<Payment[]>}
 */
const getPaymentsByTarget = async (targetType, targetId) => {
    return Payment.find({targetType, targetId})
        .sort({createdAt: -1});
};

/**
 * Get payments by customer id
 * @param {ObjectId} customerId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing payments and pagination info
 */
const getPaymentsByCustomerId = async (customerId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {customerId};

    // Apply status filter if provided
    if (options.status) {
        filter.status = options.status;
    }

    // Apply target type filter if provided
    if (options.targetType) {
        filter.targetType = options.targetType;
    }

    const payments = await Payment.find(filter)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit);

    const totalResults = await Payment.countDocuments(filter);

    return {
        results: payments,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Update payment by id
 * @param {ObjectId} paymentId
 * @param {Object} updateBody
 * @returns {Promise<Payment>}
 */
const updatePaymentById = async (paymentId, updateBody) => {
    const payment = await getPaymentById(paymentId);
    if (!payment) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }

    Object.assign(payment, updateBody);
    await payment.save();
    return payment;
};

/**
 * Update payment status
 * @param {ObjectId} paymentId
 * @param {string} status - New payment status
 * @param {Object} [transactionData] - Optional transaction data
 * @returns {Promise<Payment>}
 */
const updatePaymentStatus = async (paymentId, status, transactionData = {}) => {
    const payment = await getPaymentById(paymentId);
    if (!payment) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }

    payment.status = status;

    // Update transaction data if provided
    if (transactionData.transactionId) {
        payment.transactionId = transactionData.transactionId;
    }

    if (transactionData.responseData) {
        payment.responseData = transactionData.responseData;
    }

    await payment.save();
    return payment;
};

/**
 * Process refund
 * @param {ObjectId} paymentId
 * @param {Object} refundData
 * @returns {Promise<Payment>}
 */
const processRefund = async (paymentId, refundData = {}) => {
    const payment = await getPaymentById(paymentId);
    if (!payment) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }

    if (payment.status !== 'completed') {
        throw new ApiError(status.BAD_REQUEST, 'Only completed payments can be refunded');
    }

    payment.status = 'refunded';

    // Store refund data if provided
    if (Object.keys(refundData).length > 0) {
        payment.refundData = refundData;
    }

    await payment.save();
    return payment;
};

/**
 * Create payment intent for an order
 * @param {ObjectId} orderId
 * @param {string} paymentMethod
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
const createPaymentIntent = async (orderId, paymentMethod, userId) => {
    // Get the order
    const order = await Order.findById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Validate that the order belongs to this user
    if (order.customerId.toString() !== userId) {
        throw new ApiError(status.FORBIDDEN, 'You are not authorized to pay for this order');
    }

    // Check if order is already paid
    if (order.paymentStatus === 'paid') {
        throw new ApiError(status.BAD_REQUEST, 'Order is already paid');
    }

    // For cash payments
    if (paymentMethod === 'cash') {
        const payment = await createPayment({
            targetType: 'order',
            targetId: orderId,
            customerId: userId,
            amount: order.totalAmount,
            method: 'cash',
            status: 'pending'
        });

        // Update order with payment reference
        order.paymentId = payment._id;
        order.paymentMethod = 'cash';
        await order.save();

        return {
            paymentId: payment._id,
            paymentMethod: 'cash',
            status: 'pending',
            amount: order.totalAmount
        };
    }

    // For card payments - create a pending payment
    const payment = await createPayment({
        targetType: 'order',
        targetId: orderId,
        customerId: userId,
        amount: order.totalAmount,
        method: 'credit_card',
        status: 'pending'
    });

    // Update order with payment reference
    order.paymentId = payment._id;
    order.paymentMethod = 'credit_card';
    await order.save();

    // Return payment intent details
    return {
        paymentIntentId: payment._id.toString(),
        amount: order.totalAmount,
        currency: 'usd', // Adjust as needed for your locale
        description: `Payment for order ${ order.orderNumber }`
    };
};

/**
 * Confirm payment
 * @param {string} clientSecret
 * @param {ObjectId} userId
 * @returns {Promise<Payment>}
 */
const confirmPayment = async (clientSecret, userId) => {
    const payment = await getPaymentByClientSecret(clientSecret);
    if (!payment) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }

    if (payment.customerId.toString() !== userId.toString()) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    // Update payment status
    payment.status = 'completed';
    await payment.save();

    // If this is an order payment, update the order
    if (payment.targetType === 'order') {
        const order = await Order.findById(payment.targetId);
        if (order) {
            order.paymentStatus = 'paid';

            // Update order status to confirmed if payment is completed
            if (order.status === 'checkout') {
                order.status = 'pending';
            }

            await order.save();
        }
    } else if (payment.targetType === 'booking') {
        const booking = await Booking.findById(payment.targetId);
        if (booking) {
            booking.paymentStatus = 'paid';

            if (booking.status === 'checkout') {
                booking.status = 'booked';
            }
            await booking.save();
        }
    }

    return payment;
};

/**
 * Cancel payment
 * @param {string} clientSecret
 * @param {ObjectId} userId
 * @returns {Promise<void>}
 */
const cancelPayment = async (clientSecret, userId) => {
    const payment = await getPaymentByClientSecret(clientSecret);
    if (!payment) {
        throw new ApiError(status.NOT_FOUND, 'Payment not found');
    }

    // Validate that the payment belongs to this user
    if (payment.customerId.toString() !== userId) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    // Update payment status
    payment.status = 'failed';
    await payment.save();

    // If this is an order payment, update the order
    if (payment.targetType === 'order') {
        const order = await Order.findById(payment.targetId);
        if (order) {
            order.paymentStatus = 'failed';
            await order.save();
        }
    } else if (payment.targetType === 'booking') {
        const booking = await Booking.findById(payment.targetId);
        if (booking) {
            booking.paymentStatus = 'failed';
            await booking.save();
        }
    }
};

/**
 * Get user payments
 * @param {ObjectId} userId
 * @returns {Promise<Payment[]>}
 */
const getUserPayments = async (userId) => {
    return Payment.find({customerId: userId})
        .sort({createdAt: -1});
};

module.exports = {
    createPayment,
    getPaymentById,
    getPaymentByNumber,
    getPaymentsByTarget,
    getPaymentsByCustomerId,
    updatePaymentById,
    updatePaymentStatus,
    processRefund,
    createPaymentIntent,
    confirmPayment,
    cancelPayment,
    getUserPayments
};
