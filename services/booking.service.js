const {status} = require('http-status');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Pet = require('../models/pet.model');
const ApiError = require('../utils/ApiError');
const Payment = require('../models/payment.model');
const {sendNotification} = require('./firebase.service');

/**
 * Create a booking
 * @param {Object} bookingBody
 * @returns {Promise<Booking>}
 */
const createBooking = async (bookingBody) => {
    const service = await Service.findById(bookingBody.serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    const totalAmount = bookingBody.petsId.length * (service.onSale ? service.salePrice : service.price);

    bookingBody.totalAmount = totalAmount;

    // Add initial status history entry
    if (!bookingBody.statusHistory) {
        if (bookingBody.status === 'booked') {
            bookingBody.statusHistory = [{
                status: 'booked',
                timestamp: new Date(),
                note: 'Lịch được đặt thành công'
            }];
        }
    }

    const booking = await Booking.create(bookingBody);
    if (booking && booking.status === 'booked') {
        // Send notification to customer
        await sendNotification({
            userId: booking.customerId._id.toString(),
            title: 'Lịch hẹn đã được đặt',
            body: `Lịch hẹn của bạn với dịch vụ ${ service.name } đã được xác nhận.`,
            link: `/bookings/${ booking._id }`
        });
    }
    return booking;
};

/**
 * Get booking by id
 * @param {ObjectId} id
 * @returns {Promise<Booking>}
 */
const getBookingById = async (id) => {
    return Booking.findById(id)
        .populate({
            path: 'serviceId',
            select: 'name price onSale salePrice',
        })
        .populate({
            path: 'petsId',
            select: 'name species breed birthDate avatar',
        }).
        populate({
            path: 'customerId',
        })
};

/**
 * Get booking by booking number
 * @param {string} bookingNumber
 * @returns {Promise<Booking>}
 */
const getBookingByNumber = async (bookingNumber) => {
    return Booking.findOne({bookingNumber});
};

/**
 * Get bookings by customer id
 * @param {ObjectId} customerId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing bookings and pagination info
 */
const getBookingsByCustomerId = async (customerId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {customerId};

    // Apply status filter if provided
    if (options.status) {
        filter.status = options.status;
    }

    if (options.search) {
        filter.$or = [
            {bookingNumber: {$regex: options.search, $options: 'i'}},
        ];
    }

    const bookings = await Booking.find(filter)
        .sort({bookingDate: -1})
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'serviceId',
            select: 'name price onSale salePrice',
        })
        .populate({
            path: 'petsId',
            select: 'name species breed birthDate',
        })
        .populate({
            path: 'paymentId'
        })
        ;

    const totalResults = await Booking.countDocuments(filter);

    return {
        results: bookings,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Get bookings by staff and admin
 * @param {Object} options - Query options
 * @return {Promise<Object>} - Object containing bookings and pagination info
 */
const getBookingsByStaffAndAdmin = async (options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (options.status) {
        filter.$and = [
            {status: options.status},
            {status: {$ne: 'checkout'}}
        ];
    } else {
        filter.status = {$ne: 'checkout'};
    }

    if (options.search) {
        filter.$or = [
            {bookingNumber: {$regex: options.search, $options: 'i'}},
        ];
    }

    let sortOptions = {bookingDate: -1}; // Default sort

    if (options.sortBy) {
        sortOptions = {};
        const sortFields = options.sortBy.split(',');

        sortFields.forEach(field => {
            if (field.startsWith('-')) {
                // Descending order
                const fieldName = field.substring(1);
                sortOptions[fieldName] = -1;
            } else {
                // Ascending order
                sortOptions[field] = 1;
            }
        });
    }

    const bookings = await Booking.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'serviceId',
            select: 'name price onSale salePrice images',
        })
        .populate({
            path: 'petsId',
            select: 'name species breed birthDate',
        })
        .populate({
            path: 'customerId',
        });

    const totalResults = await Booking.countDocuments(filter);

    return {
        results: bookings,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
}

/**
 * Update booking by id
 * @param {ObjectId} bookingId
 * @param {Object} updateBody
 * @param {String} role 
 * @returns {Promise<Booking>}
 */
const updateBookingById = async (bookingId, updateBody, role) => {
    const booking = await getBookingById(bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Handle cancellation
    if (updateBody.status === 'cancelled') {
        // Only user, admin, and staff can cancel bookings
        if (!['user', 'admin', 'staff'].includes(role)) {
            throw new ApiError(status.FORBIDDEN, 'You do not have permission to cancel this booking');
        }

        // For users, check if cancellation is at least 12 hours before booking time
        if (role === 'user') {
            const bookingDateTime = new Date(booking.bookingDate);
            const [startHour, startMinute] = booking.timeSlot.split('-')[0].split(':').map(Number);

            // Set the booking datetime to the exact hour and minute
            bookingDateTime.setHours(startHour, startMinute, 0, 0);

            // Calculate 12 hours before booking time
            const twelveHoursBefore = new Date(bookingDateTime.getTime() - 12 * 60 * 60 * 1000);
            const currentTime = new Date();

            if (currentTime > twelveHoursBefore) {
                throw new ApiError(
                    status.BAD_REQUEST,
                    'Bookings can only be cancelled at least 12 hours before the appointment time'
                );
            }
        }

        // Add cancellation reason to status history
        booking.cancellationReason = updateBody.cancellationReason || 'Khác';
        booking.status = 'cancelled';
        booking.cancelledBy = role === 'user' ? 'customer' : 'admin';

        await booking.save();
        sendNotification({
            userId: booking.customerId._id.toString(),
            title: 'Lịch hẹn đã bị huỷ',
            body: `Lịch hẹn của bạn với dịch vụ ${ booking.serviceId.name } đã bị huỷ.`,
            link: `/bookings/${ booking._id }`
        });
        return booking;
    }

    // Handle completion - only admin and staff can mark as completed
    if (updateBody.status === 'completed') {
        if (!['admin', 'staff'].includes(role)) {
            throw new ApiError(
                status.FORBIDDEN,
                'Only administrators and staff can mark bookings as completed'
            );
        }

        booking.status = 'completed';
        const service = await Service.findById(booking.serviceId);
        if (!service) {
            throw new ApiError(status.NOT_FOUND, 'Service not found');
        }
        service.usageCount = (service.usageCount || 0) + 1;
        await service.save();

        sendNotification({
            userId: booking.customerId._id.toString(),
            title: 'Lịch hẹn đã hoàn thành',
            body: `Lịch hẹn của bạn với dịch vụ ${ service.name } đã được hoàn thành.`,
            link: `/bookings/${ booking._id }`
        });

        await booking.save();
        return booking;
    }
};

/**
 * Cancel booking
 * @param {ObjectId} bookingId
 * @param {string} cancellationReason
 * @param {string} role
 * @returns {Promise<Booking>}
 */
const cancelBooking = async (bookingId, cancellationReason, role = "user") => {
    const booking = await getBookingById(bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    // Check if booking can be cancelled (not completed or already cancelled)
    if (['completed', 'cancelled'].includes(booking.status)) {
        throw new ApiError(status.BAD_REQUEST, `Booking cannot be cancelled when status is ${ booking.status }`);
    }

    // For customer cancellations, check if cancellation is at least 12 hours before booking time
    if (role === 'user') {
        const bookingDateTime = new Date(booking.bookingDate);
        const [startHour, startMinute] = booking.timeSlot.split('-')[0].split(':').map(Number);

        // Set the booking datetime to the exact hour and minute
        bookingDateTime.setHours(startHour, startMinute, 0, 0);

        // Calculate 12 hours before booking time
        const twelveHoursBefore = new Date(bookingDateTime.getTime() - 12 * 60 * 60 * 1000);
        const currentTime = new Date();

        if (currentTime > twelveHoursBefore) {
            throw new ApiError(
                status.BAD_REQUEST,
                'Bookings can only be cancelled at least 12 hours before the appointment time'
            );
        }
    }

    booking.status = 'cancelled';
    booking.cancellationReason = cancellationReason || 'Khác';
    booking.cancelledBy = role === 'user' ? 'customer' : 'admin';

    await booking.save();
    sendNotification({
        userId: booking.customerId._id.toString(),
        title: 'Lịch hẹn đã bị huỷ',
        body: `Lịch hẹn của bạn với dịch vụ ${ booking.serviceId.name } đã bị huỷ.`,
        link: `/bookings/${ booking._id }`
    });
    return booking;
};

/**
 * Update booking service record
 * @param {ObjectId} bookingId
 * @param {Object} serviceRecordData
 * @returns {Promise<Booking>}
 */
const updateBookingServiceRecord = async (bookingId, serviceRecordData) => {
    const booking = await getBookingById(bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    booking.serviceRecord = {
        ...booking.serviceRecord,
        ...serviceRecordData
    };

    await booking.save();
    return booking;
};

/**
 * Get upcoming bookings for a date range
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @param {Object} options - Query options
 * @returns {Promise<Booking[]>}
 */
const getUpcomingBookings = async (startDate, endDate, options = {}) => {
    const filter = {
        bookingDate: {$gte: startDate, $lte: endDate},
        status: 'booked'
    };

    return Booking.find(filter)
        .sort({bookingDate: 1, timeSlot: 1})  // Sort by timeSlot string directly
        .limit(options.limit || 100)
        .populate({
            path: 'serviceId',
            select: 'name price onSale salePrice',
        })
        .populate({
            path: 'petsId',
            select: 'name species breed birthDate',
        })
        .populate({
            path: 'customerId',
            select: 'fullname email phone avatar'
        });
};

/**
 * Get date ranges for analytics
 * @param {string} period - day, month, year, or null for current month
 * @param {number} year - Year for the report
 * @param {number} month - Month for the report
 * @param {number} day - Day for the report
 * @returns {Object} - startDate, endDate, prevStartDate, prevEndDate
 */
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return {startDate, endDate, prevStartDate, prevEndDate};
};

/**
 * Get booking analytics
 * @param {string} period - day, month, year, or null for current month
 * @param {number} year - Year for the report
 * @param {number} month - Month for the report
 * @param {number} day - Day for the report
 * @returns {Promise<Object>} - Analytics data
 */
const getBookingAnalytics = async (period, year, month, day) => {
    const {startDate, endDate, prevStartDate, prevEndDate} = getDateRanges(period, year, month, day);

    // Current period bookings
    const currentStats = await Booking.aggregate([
        {
            $match: {
                createdAt: {$gte: startDate, $lte: endDate},
                status: {$in: ['booked', 'completed']}
            }
        },
        {
            $group: {
                _id: null,
                totalBookings: {$sum: 1},
                totalRevenue: {
                    $sum: {
                        $cond: [
                            {$eq: ['$status', 'completed']},
                            '$totalAmount',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    // Previous period bookings
    const prevStats = await Booking.aggregate([
        {
            $match: {
                createdAt: {$gte: prevStartDate, $lte: prevEndDate},
                status: {$in: ['booked', 'completed']}
            }
        },
        {
            $group: {
                _id: null,
                totalBookings: {$sum: 1},
                totalRevenue: {
                    $sum: {
                        $cond: [
                            {$eq: ['$status', 'completed']},
                            '$totalAmount',
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const current = currentStats[0] || {totalBookings: 0, totalRevenue: 0};
    const previous = prevStats[0] || {totalBookings: 0, totalRevenue: 0};

    return {
        current: {
            totalBookings: current.totalBookings,
            totalRevenue: current.totalRevenue
        },
        previous: {
            totalBookings: previous.totalBookings,
            totalRevenue: previous.totalRevenue
        },
        growth: {
            bookingsGrowth: previous.totalBookings > 0
                ? ((current.totalBookings - previous.totalBookings) / previous.totalBookings * 100).toFixed(2)
                : current.totalBookings > 0 ? 100 : 0,
            revenueGrowth: previous.totalRevenue > 0
                ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue * 100).toFixed(2)
                : current.totalRevenue > 0 ? 100 : 0
        }
    };
};

const deleteExpiredBookings = async () => {
    const now = new Date();
    const expirationTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

    const result = await Booking.find({
        status: 'checkout',
        createdAt: {$lt: expirationTime}
    });

    result.forEach(async (booking) => {
        if (booking.paymentId) {
            await Payment.deleteOne({_id: booking.paymentId});
        }
        await Booking.deleteOne({_id: booking._id});
    });
};

module.exports = {
    createBooking,
    getBookingById,
    getBookingByNumber,
    getBookingsByCustomerId,
    getBookingsByStaffAndAdmin,
    updateBookingById,
    cancelBooking,
    updateBookingServiceRecord,
    getUpcomingBookings,
    getBookingAnalytics,
    deleteExpiredBookings
};
