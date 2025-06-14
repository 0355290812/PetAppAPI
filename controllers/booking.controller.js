const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {bookingService, paymentService} = require('../services');
const ApiError = require('../utils/ApiError');

const createBooking = catchAsync(async (req, res) => {
    const statusBooking = req.body.paymentMethod === 'credit_card' ? 'checkout' : 'booked';

    const booking = await bookingService.createBooking({
        ...req.body,
        status: statusBooking,
        customerId: req.user._id
    });
    if (!booking) {
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Booking creation failed');
    }
    if (req.body.paymentMethod === 'credit_card') {
        // Create a payment intent
        const payment = await paymentService.createPayment({
            amount: booking.totalAmount,
            currency: 'vnd',
            description: `Booking for ${ booking.serviceId }`,
            targetType: 'booking',
            targetId: booking._id,
            customerId: req.user._id,
            method: req.body.paymentMethod,
            provider: 'stripe'
        });
        if (!payment) {
            throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Payment creation failed');
        }
        booking.paymentId = payment._id;
        booking.paymentStatus = 'pending';
        booking.paymentMethod = req.body.paymentMethod;

        await booking.save();
        res.status(status.CREATED).send({
            booking,
            payment
        });
        return
    }

    res.status(status.CREATED).send(booking);
});

const getBookings = catchAsync(async (req, res) => {
    const options = {
        search: req.query.search,
        status: req.query.status,
        service: req.query.service,
        date: req.query.date,
        sortBy: req.query.sortBy,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        page: req.query.page ? parseInt(req.query.page) : undefined,
    };

    // Filter out undefined values
    Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
    if (req.user.role === 'user') {
        const result = await bookingService.getBookingsByCustomerId(req.user._id, options);
        res.send(result);
    } else {
        const result = await bookingService.getBookingsByStaffAndAdmin(options);
        res.send(result);
    }

});

const getBooking = catchAsync(async (req, res) => {
    const booking = await bookingService.getBookingById(req.params.bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Verify ownership unless admin
    if (booking.customerId._id.toString() !== req.user._id.toString() && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    res.send(booking);
});

const getBookingByNumber = catchAsync(async (req, res) => {
    const booking = await bookingService.getBookingByNumber(req.params.bookingNumber);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Verify ownership unless admin
    if (booking.customerId.toString() !== req.user._id && req.user.role !== 'admin') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    res.send(booking);
});

const updateBooking = catchAsync(async (req, res) => {
    const booking = await bookingService.getBookingById(req.params.bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Verify ownership unless admin
    if (booking.customerId._id.toString() !== req.user._id.toString() && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    if (req.user.role === 'user' && booking.status !== 'booked' && req.body.status !== 'cancelled') {
        throw new ApiError(status.FORBIDDEN, 'You can only cancel a booking');
    }

    const updateBody = {
        ...req.body,
        status: req.body.status,
    };

    const updatedBooking = await bookingService.updateBookingById(req.params.bookingId, updateBody, role = req.user.role);
    res.send(updatedBooking);
});

const cancelBooking = catchAsync(async (req, res) => {
    const booking = await bookingService.getBookingById(req.params.bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Check if the user is authorized to cancel this booking
    if (req.user.role === 'user' && booking.customerId._id.toString() !== req.user._id.toString()) {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    // Users can only cancel pending bookings
    if (req.user.role === 'user' && booking.status !== 'checkout' && booking.status !== 'booked') {
        throw new ApiError(status.BAD_REQUEST, 'Only booked bookings can be cancelled');
    }

    if (booking.status === 'checkout') {
        res.status(200).send({
            message: 'Booking is waiting for payment',
        });
        return;
    }

    const cancelledBy = req.user.role === 'user' ? 'customer' : 'admin';
    const cancelReason = req.body?.cancellationReason ? req.body?.cancellationReason : 'Khác';

    await bookingService.cancelBooking(req.params.bookingId, cancelReason, cancelledBy);
    res.status(status.OK).send({
        message: 'Booking cancelled successfully',
    });
});

const getUpcomingBookings = catchAsync(async (req, res) => {
    // Admin only endpoint
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    endDate.setDate(endDate.getDate() + 30); // Default to 30 days ahead if not specified

    const options = {
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
        page: req.query.page ? parseInt(req.query.page) : 1,
    };

    const bookings = await bookingService.getUpcomingBookings(startDate, endDate, options);
    res.send(bookings);
});

const getBookingAnalytics = catchAsync(async (req, res) => {
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const {period, year, month, day} = req.query;
    const analytics = await bookingService.getBookingAnalytics(period, year, month, day);

    res.send({
        success: true,
        data: analytics
    });
});

module.exports = {
    createBooking,
    getBookings,
    getBooking,
    getBookingByNumber,
    updateBooking,
    cancelBooking,
    getUpcomingBookings,
    getBookingAnalytics
};
