const {status} = require('http-status');
const Order = require('../models/order.model');
const Product = require('../models/product.model'); // Add import for Product model
const ApiError = require('../utils/ApiError');
const Review = require('../models/review.model');

/**
 * Create an order
 * @param {Object} orderBody
 * @returns {Promise<Order>}
 */
const createOrder = async (orderBody) => {
    // Check product availability and update quantities
    for (const item of orderBody.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
            throw new ApiError(status.NOT_FOUND, `Product ${ item.productId } not found`);
        }
        if (product.stock < item.quantity) {
            throw new ApiError(status.BAD_REQUEST, `Not enough stock for ${ product.name }`);
        }

        // Calculate item price and subtotal
        item.name = product.name;
        item.price = product.price;
        item.onSale = product.onSale;
        item.salePrice = product.salePrice;
        item.subtotal = item.quantity * (product.onSale ? product.salePrice : product.price);
        item.image = product.images && product.images.length > 0 ? product.images[0] : null;

        // Update product stock
        product.stock -= item.quantity;
        await product.save();
    }

    // Calculate order totals
    orderBody.subtotal = orderBody.items.reduce((acc, item) => acc + item.subtotal, 0);
    orderBody.totalAmount = orderBody.subtotal + (orderBody.subtotal >= 500000 ? 0 : 30000) - (orderBody.discount || 0);
    if (orderBody.totalAmount >= 500000) {
        orderBody.shippingFee = 0;
    } else {
        orderBody.shippingFee = 30000;
    }

    // Add initial status history entry
    if (!orderBody.statusHistory && orderBody.status !== 'checkout') {
        orderBody.statusHistory = [{
            status: 'pending',
            timestamp: new Date(),
            note: 'Đơn hàng đã được đặt'
        }];
    }

    return Order.create(orderBody);
};

/**
 * Get order by id
 * @param {ObjectId} id
 * @returns {Promise<Order>}
 */
const getOrderById = async (id) => {
    return Order.findById(id)
        .populate('customerId')
        .populate('paymentId')
};

/**
 * Get order by order number
 * @param {string} orderNumber
 * @returns {Promise<Order>}
 */
const getOrderByNumber = async (orderNumber) => {
    return Order.findOne({orderNumber});
};

/**
 * Get orders by customer id
 * @param {ObjectId} customerId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing orders and pagination info
 */
const getOrdersByCustomerId = async (customerId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {customerId};

    // Apply status filter if provided
    if (options.status) {
        filter.status = options.status;
    }

    const orders = await Order.find(filter)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate('paymentId');

    // Get all order IDs
    const orderIds = orders.map(order => order._id);

    // Find all reviews associated with these orders
    const reviews = await Review.find({
        sourceType: 'order',
        sourceId: {$in: orderIds},
        customerId
    });

    // Create a map of order ID to review status
    const reviewMap = {};
    reviews.forEach(review => {
        reviewMap[review.sourceId.toString()] = true;
    });

    // Add isRated property to each order
    const ordersWithRatingStatus = orders.map(order => {
        const orderObject = order.toObject();
        orderObject.isRated = !!reviewMap[order._id.toString()];
        return orderObject;
    });

    const totalResults = await Order.countDocuments(filter);

    return {
        results: ordersWithRatingStatus,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Update order by id
 * @param {ObjectId} orderId
 * @param {Object} updateBody
 * @returns {Promise<Order>}
 */
const updateOrderById = async (orderId, updateBody) => {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // If status is being updated, add to status history
    if (updateBody.status && updateBody.status !== order.status) {
        if (!order.statusHistory) {
            order.statusHistory = [];
        }

        if (updateBody.status === 'cancelled') {
            order.cancelReason = updateBody.cancelReason || 'Khác';
            order.cancelledBy = 'admin';
            order.statusHistory.push({
                status: 'cancelled',
                timestamp: new Date(),
                note: "Đơn hàng đã bị huỷ"
            });
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                if (product) {
                    product.stock += item.quantity; // Deduct stock for shipping
                    await product.save();
                }
            }
        }
        if (updateBody.status === 'delivered') {
            order.statusHistory.push({
                status: 'delivered',
                timestamp: new Date(),
                note: 'Đơn hàng đã được giao'
            });
            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                if (product) {
                    product.soldCount += item.quantity; // Deduct stock for shipping
                    await product.save();
                }
            }
        }
        if (updateBody.status === 'shipping') {
            order.statusHistory.push({
                status: 'shipping',
                timestamp: new Date(),
                note: 'Đơn hàng đang được giao đến bạn'
            });
        }
    }

    Object.assign(order, updateBody);
    await order.save();
    return order;
};

/**
 * Cancel order
 * @param {ObjectId} orderId
 * @param {string} cancellationReason
 * @returns {Promise<Order>}
 */
const cancelOrder = async (orderId, cancelReason, cancelledBy) => {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Check if order can be cancelled (not delivered or already cancelled)
    if (['delivered', 'cancelled'].includes(order.status)) {
        throw new ApiError(status.BAD_REQUEST, `Order cannot be cancelled when status is ${ order.status }`);
    }

    order.status = 'cancelled';
    order.cancelReason = cancelReason;
    order.cancelledBy = cancelledBy;
    order.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: "Đơn hàng đã bị huỷ"
    });

    for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
            product.stock += item.quantity; // Restore stock
            await product.save();
        }
    }

    // Refund payment if paymentMethod is credit card

    await order.save();
    return order;
};

/**
 * Update order payment status
 * @param {ObjectId} orderId
 * @param {string} paymentStatus
 * @returns {Promise<Order>}
 */
const updateOrderPaymentStatus = async (orderId, paymentStatus) => {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    order.paymentStatus = paymentStatus;
    await order.save();
    return order;
};

/**
 * Get recent orders
 * @param {Object} options - Query options
 * @returns {Promise<Order[]>}
 */
const getRecentOrders = async (options = {}) => {
    const limit = options.limit || 20;

    return Order.find()
        .sort({createdAt: -1})
        .limit(limit);
};

/**
 * Get user orders
 * @param {ObjectId} userId
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getUserOrders = async (userId, options = {}) => {
    return getOrdersByCustomerId(userId, options);
};

/**
 * Process order payment
 * @param {ObjectId} orderId
 * @param {string} paymentMethod
 * @param {Object} paymentDetails
 * @returns {Promise<Object>}
 */
const processOrderPayment = async (orderId, paymentMethod, paymentDetails = {}) => {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Update order with payment information
    order.paymentMethod = paymentMethod;
    order.paymentDetails = paymentDetails;

    if (paymentMethod === 'cash') {
        order.paymentStatus = 'pending';
    } else if (paymentDetails.status === 'completed') {
        order.paymentStatus = 'paid';

        // Update order status to confirmed if payment is completed
        if (order.status === 'pending') {
            order.status = 'confirmed';
            order.statusHistory.push({
                status: 'confirmed',
                timestamp: new Date(),
                note: 'Payment completed'
            });
        }
    }

    await order.save();
    return order;
};

/**
 * Query orders with filtering and pagination
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Query options (pagination, sorting)
 * @returns {Promise<Object>}
 */
const queryOrders = async (filter = {}, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || '-createdAt';

    const orders = await Order.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'fullname email phone');

    const totalResults = await Order.countDocuments(filter);

    return {
        results: orders,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Confirm order delivery by customer
 * @param {ObjectId} orderId
 * @returns {Promise<Order>}
 */
const confirmOrderDelivery = async (orderId, userId) => {
    const order = await getOrderById(orderId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Verify that the order belongs to this user
    if (order.customerId._id.toString() !== userId.toString()) {
        throw new ApiError(status.FORBIDDEN, 'You are not authorized to confirm this order');
    }

    // Check if order is in shipping status
    if (order.status !== 'shipping') {
        throw new ApiError(status.BAD_REQUEST, 'Only shipping orders can be confirmed as delivered');
    }

    // Update order status to delivered
    order.status = 'delivered';


    // Add to status history
    if (!order.statusHistory) {
        order.statusHistory = [];
    }

    order.statusHistory.push({
        status: 'delivered',
        timestamp: new Date(),
        note: 'Đơn hàng đã hoàn thành'
    });

    // Update product sold count when order is confirmed as delivered
    for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
            product.soldCount += item.quantity;
            await product.save();
        }
    }

    await order.save();
    return order;
};

const getDateRanges = (period, year, month, day) => {
    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;

    if (period === 'day' && year && month && day) {
        startDate = new Date(year, month - 1, day);
        endDate = new Date(year, month - 1, day, 23, 59, 59);
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 1);
        prevEndDate = new Date(prevStartDate);
        prevEndDate.setHours(23, 59, 59);
    } else if (period === 'month' && year && month) {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
        prevStartDate = new Date(year, month - 2, 1);
        prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);
    } else if (period === 'year' && year) {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
        prevStartDate = new Date(year - 1, 0, 1);
        prevEndDate = new Date(year - 1, 11, 31, 23, 59, 59);
    } else {
        // Default to current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return {startDate, endDate, prevStartDate, prevEndDate};
};

const getOrderAnalytics = async (period, year, month, day) => {
    const {startDate, endDate, prevStartDate, prevEndDate} = getDateRanges(period, year, month, day);

    // Current period orders
    const currentStats = await Order.aggregate([
        {
            $match: {
                createdAt: {$gte: startDate, $lte: endDate},
                status: {$in: ['pending', 'shipping', 'delivered']}
            }
        },
        {
            $group: {
                _id: null,
                totalOrders: {$sum: 1},
                totalRevenue: {
                    $sum: {
                        $cond: [
                            {$eq: ['$status', 'delivered']},
                            '$totalAmount',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    // Previous period orders
    const prevStats = await Order.aggregate([
        {
            $match: {
                createdAt: {$gte: prevStartDate, $lte: prevEndDate},
                status: {$in: ['pending', 'shipping', 'delivered']}
            }
        },
        {
            $group: {
                _id: null,
                totalOrders: {$sum: 1},
                totalRevenue: {
                    $sum: {
                        $cond: [
                            {$eq: ['$status', 'delivered']},
                            '$totalAmount',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const current = currentStats[0] || {totalOrders: 0, totalRevenue: 0};
    const previous = prevStats[0] || {totalOrders: 0, totalRevenue: 0};

    return {
        current: {
            totalOrders: current.totalOrders,
            totalRevenue: current.totalRevenue
        },
        previous: {
            totalOrders: previous.totalOrders,
            totalRevenue: previous.totalRevenue
        },
        growth: {
            ordersGrowth: previous.totalOrders > 0
                ? ((current.totalOrders - previous.totalOrders) / previous.totalOrders * 100).toFixed(2)
                : current.totalOrders > 0 ? 100 : 0,
            revenueGrowth: previous.totalRevenue > 0
                ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue * 100).toFixed(2)
                : current.totalRevenue > 0 ? 100 : 0
        }
    };
};

module.exports = {
    createOrder,
    getOrderById,
    getOrderByNumber,
    getOrdersByCustomerId,
    updateOrderById,
    cancelOrder,
    updateOrderPaymentStatus,
    getRecentOrders,
    getUserOrders,
    queryOrders,
    processOrderPayment,
    confirmOrderDelivery,
    getOrderAnalytics
};
