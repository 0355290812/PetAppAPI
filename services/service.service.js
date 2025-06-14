const {status} = require('http-status');
const Service = require('../models/service.model');
const ApiError = require('../utils/ApiError');
const Review = require('../models/review.model');
const User = require('../models/user.model');
const Booking = require('../models/booking.model');

/**
 * Create a service
 * @param {Object} serviceBody
 * @returns {Promise<Service>}
 */
const createService = async (serviceBody) => {
    return Service.create(serviceBody);
};

/**
 * Get service by id
 * @param {ObjectId} id
 * @returns {Promise<Service>}
 */
const getServiceById = async (id) => {
    return Service.findById(id)
        .populate({
            path: 'recentReviews',
            populate: {
                path: 'customerId',
            }
        })
        .populate({
            path: 'recentReviews',
            populate: {
                path: 'reply',
                populate: {
                    path: 'staffId',
                }
            }
        })
};

/**
 * Get all services
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Query options
 * @param {string} [options.sort] - Sort option in the format: 'field' or '-field' for descending
 * @param {number} [options.limit] - Maximum number of results per page
 * @param {number} [options.page] - Current page
 * @returns {Promise<Object>} - Object containing services and pagination info
 */
const getAllServices = async (filter = {}, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Create sort object from sort string (e.g. '-createdAt' or 'price')
    let sortObj = {createdAt: -1}; // default sorting
    if (options.sort) {
        if (options.sort.startsWith('-')) {
            sortObj = {[options.sort.substring(1)]: -1};
        } else {
            sortObj = {[options.sort]: 1};
        }
    }

    // Default to active services unless specified otherwise
    if (filter.isVisible === undefined) {
        filter.isVisible = true;
    }

    // Name search (partial match, case-insensitive)
    if (filter.name && filter.name.$regex) {
        // Ensure the regex is case-insensitive
        filter.name = {$regex: filter.name.$regex, $options: 'i'};
    }

    // Text search (ensure case-insensitive collation is used)
    const searchOptions = {collation: {locale: 'en', strength: 2}};

    const services = await Service.find(filter)
        .collation(searchOptions.collation) // Apply case-insensitive collation to the query
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
    // .populate('recentReviews');

    const totalResults = await Service.countDocuments(filter);

    return {
        results: services,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Get featured services
 * @param {number} limit - Maximum number of services to return
 * @returns {Promise<Service[]>}
 */
const getFeaturedServices = async (limit = 10) => {
    return Service.find({isVisible: true, isFeatured: true})
        .sort({createdAt: -1})
        .limit(limit);
};

/**
 * Get services on sale
 * @param {number} limit - Maximum number of services to return
 * @returns {Promise<Service[]>}
 */
const getSaleServices = async (limit = 10) => {
    return Service.find({isVisible: true, onSale: true})
        .sort({createdAt: -1})
        .limit(limit);
};

/**
 * Get services by category
 * @param {ObjectId} categoryId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing services and pagination info
 */
const getServicesByCategory = async (categoryId, options = {}) => {
    return getAllServices({isVisible: true}, options);
};

/**
 * Update service by id
 * @param {ObjectId} serviceId
 * @param {Object} updateBody
 * @returns {Promise<Service>}
 */
const updateServiceById = async (serviceId, updateBody) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    Object.assign(service, updateBody);
    await service.save();
    return service;
};

/**
 * Delete service by id
 * @param {ObjectId} serviceId
 * @returns {Promise<Service>}
 */
const deleteServiceById = async (serviceId) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    await service.deleteOne();
    return service;
};

/**
 * Search services with text search
 * @param {string} searchQuery - Search term
 * @param {Object} filter - Additional filter criteria
 * @param {Object} options - Query options (pagination, sorting)
 * @returns {Promise<Object>} - Object containing services and pagination info
 */
const searchServices = async (searchQuery, filter = {}, options = {}) => {
    // Add text search criteria to filter
    if (searchQuery && searchQuery.trim() !== '') {
        // Use case-insensitive text search
        filter.$text = {$search: searchQuery};

        // Use text score for sorting relevance if no other sort is specified
        if (!options.sort) {
            options.sort = 'score';
            options.score = {$meta: 'textScore'};
        }

        // Ensure options include case-insensitive collation
        options.collation = {locale: 'en', strength: 2};
    }

    // Default to active services unless specified otherwise
    if (filter.isVisible === undefined) {
        filter.isVisible = true;
    }

    return getAllServices(filter, options);
};

/**
 * Get services by pet type
 * @param {string} petType - Type of pet
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing services and pagination info
 */
const getServicesByPetType = async (petType, options = {}) => {
    return getAllServices({petTypes: petType, isVisible: true}, options);
};

/**
 * Toggle service featured status
 * @param {ObjectId} serviceId
 * @returns {Promise<Service>}
 */
const toggleServiceFeatured = async (serviceId) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    service.isFeatured = !service.isFeatured;
    await service.save();
    return service;
};

/**
 * Toggle service visible status
 * @param {ObjectId} serviceId
 * @returns {Promise<Service>}
 */
const toggleServiceVisible = async (serviceId) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    service.isVisible = !service.isVisible;
    await service.save();
    return service;
};

/**
 * Update service availability
 * @param {ObjectId} serviceId
 * @param {Object} availabilityData - Availability data
 * @returns {Promise<Service>}
 */
const updateServiceAvailability = async (serviceId, availabilityData) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    // Update the availability field
    if (availabilityData.availability) {
        service.availability = {
            ...service.availability,
            ...availabilityData.availability
        };
    }

    // Update excluded holidays if provided
    if (availabilityData.excludedHolidays) {
        service.excludedHolidays = availabilityData.excludedHolidays;
    }

    await service.save();
    return service;
};

/**
 * Update service images
 * @param {ObjectId} serviceId
 * @param {Array} images - New images array
 * @returns {Promise<Service>}
 */
const updateServiceImages = async (serviceId, images) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    service.images = images;
    await service.save();
    return service;
};

/**
 * Get available timeslots for a service for the next 14 days
 * @param {ObjectId} serviceId - Service ID
 * @returns {Promise<Object>} - Object containing available timeslots by date
 */
const getServiceAvailableTimeslots = async (serviceId) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    // Get service availability settings
    const {availability, excludedHolidays} = service;

    // Get current date and time in Vietnam timezone (GMT+7)
    // Create date with the timezone offset for Vietnam (GMT+7 = +420 minutes)
    const currentDateTime = new Date();
    const vietnamOffset = 7 * 60; // Vietnam timezone offset in minutes (GMT+7)
    const currentUTCMinutes = currentDateTime.getUTCHours() * 60 + currentDateTime.getUTCMinutes();
    const currentVietnamMinutes = (currentUTCMinutes + vietnamOffset) % (24 * 60);
    const currentVietnamHour = Math.floor(currentVietnamMinutes / 60);
    const currentVietnamMinute = currentVietnamMinutes % 60;

    // Minimum booking time (current time + 30 minutes)
    const minBookingMinutes = currentVietnamMinutes + 30;

    // Get bookings for this service in the next 14 days
    // Adjust dates for Vietnam timezone
    const startDate = new Date();
    const vietnamDate = new Date(currentDateTime);
    vietnamDate.setUTCHours(currentVietnamHour, currentVietnamMinute, 0, 0);

    // If the Vietnam time's day is ahead of UTC day, adjust the date
    if (vietnamDate.getUTCHours() < currentDateTime.getUTCHours()) {
        vietnamDate.setUTCDate(vietnamDate.getUTCDate() + 1);
    }

    const endDate = new Date(vietnamDate);
    endDate.setDate(endDate.getDate() + 14);

    // Fetch existing bookings from the database
    const Booking = require('../models/booking.model');
    const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {$gte: startDate, $lte: endDate},
        status: {$nin: ['cancelled', 'rejected']}
    });

    // Create a map to store booked slots
    const bookedSlots = {};
    existingBookings.forEach(booking => {
        const dateKey = booking.bookingDate.toISOString().split('T')[0];
        if (!bookedSlots[dateKey]) {
            bookedSlots[dateKey] = [];
        }
        bookedSlots[dateKey].push({
            startTime: booking.timeSlot.split('-')[0],
            endTime: booking.timeSlot.split('-')[1]
        });
    });

    // Create a map to store excluded holidays for faster lookup
    const excludedDays = new Set();
    excludedHolidays.forEach(date => {
        excludedDays.add(date.toISOString().split('T')[0]);
    });

    // Generate available timeslots for each day
    const availableTimeslots = {};
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let i = 0; i < 14; i++) {
        // Create date for Vietnam timezone
        const vietnamDateForDay = new Date(vietnamDate);
        vietnamDateForDay.setDate(vietnamDate.getDate() + i);
        const dateKey = vietnamDateForDay.toISOString().split('T')[0];
        const isToday = i === 0;

        // Skip if it's an excluded holiday
        if (excludedDays.has(dateKey)) {
            availableTimeslots[dateKey] = [];
            continue;
        }

        const dayOfWeek = daysOfWeek[vietnamDateForDay.getDay()];
        const dayAvailability = availability[dayOfWeek];

        // Skip if the day is closed
        if (!dayAvailability || !dayAvailability.isOpen) {
            availableTimeslots[dateKey] = [];
            continue;
        }

        // Generate all possible timeslots for this day
        const {openTime, closeTime, slotDuration} = dayAvailability;
        const slots = generateTimeslots(openTime, closeTime, slotDuration, service.duration || slotDuration);

        // Filter out booked slots
        const dayBookedSlots = bookedSlots[dateKey] || [];
        let availableSlots = filterAvailableSlots(slots, dayBookedSlots, service.capacity || 1);

        // For today, filter out slots that are in the past or less than 30 minutes from now
        if (isToday) {
            availableSlots = availableSlots.filter(slot => {
                const slotStartMinutes = timeToMinutes(slot.startTime);
                return slotStartMinutes >= minBookingMinutes;
            });
        }

        availableTimeslots[dateKey] = availableSlots;
    }

    return availableTimeslots;
};

/**
 * Generate all possible timeslots for a day
 * @param {String} openTime - Opening time (HH:MM format)
 * @param {String} closeTime - Closing time (HH:MM format)
 * @param {Number} slotDuration - Duration of each slot in minutes
 * @param {Number} serviceDuration - Duration of the service in minutes
 * @returns {Array} - Array of timeslots
 */
const generateTimeslots = (openTime, closeTime, slotDuration, serviceDuration) => {
    const slots = [];

    // Convert times to minutes for easier calculation
    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    // Generate slots with the specified duration
    for (let start = openMinutes; start <= closeMinutes - serviceDuration; start += slotDuration) {
        const startHour = Math.floor(start / 60);
        const startMinute = start % 60;

        const end = start + serviceDuration;
        const endHour = Math.floor(end / 60);
        const endMinute = end % 60;

        const startTimeStr = `${ startHour.toString().padStart(2, '0') }:${ startMinute.toString().padStart(2, '0') }`;
        const endTimeStr = `${ endHour.toString().padStart(2, '0') }:${ endMinute.toString().padStart(2, '0') }`;

        slots.push({
            startTime: startTimeStr,
            endTime: endTimeStr,
            availableSpots: 0 // Will be updated later
        });
    }

    return slots;
};

/**
 * Filter available slots based on booked slots and capacity
 * @param {Array} allSlots - All possible timeslots
 * @param {Array} bookedSlots - Already booked slots
 * @param {Number} capacity - Maximum capacity for the service
 * @returns {Array} - Available timeslots
 */
const filterAvailableSlots = (allSlots, bookedSlots, capacity) => {
    // Set default available spots to capacity for all slots
    allSlots.forEach(slot => {
        slot.availableSpots = capacity;
    });

    // Reduce available spots based on bookings
    bookedSlots.forEach(booked => {
        const bookedStartMinutes = timeToMinutes(booked.startTime);
        const bookedEndMinutes = timeToMinutes(booked.endTime);

        allSlots.forEach(slot => {
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);

            // Check if the slots overlap
            if (
                (slotStartMinutes <= bookedStartMinutes && bookedStartMinutes < slotEndMinutes) ||
                (slotStartMinutes < bookedEndMinutes && bookedEndMinutes <= slotEndMinutes) ||
                (bookedStartMinutes <= slotStartMinutes && slotEndMinutes <= bookedEndMinutes)
            ) {
                slot.availableSpots = Math.max(0, slot.availableSpots - 1);
            }
        });
    });

    // Filter out slots with no available spots
    return allSlots.filter(slot => slot.availableSpots > 0);
};

/**
 * Convert time string to minutes
 * @param {String} timeStr - Time in HH:MM format
 * @returns {Number} - Time in minutes
 */
const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Get reviews for a service
 * @param {ObjectId} serviceId
 * @param {Object} options - Query options
 * @returns {Promise<Review[]>}
 */
const getReviewsByServiceId = async (serviceId, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({serviceId})
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate('customerId')
        .populate({
            path: 'reply',
            populate: {
                path: 'staffId',
            }
        });

    const totalResults = await Review.countDocuments({serviceId});

    return {
        results: reviews,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
}

/**
 * Create review for a service
 * @param {ObjectId} serviceId
 * @param {Object} reviewBody
 * @returns {Promise<Review>}
 */
const createReview = async (serviceId, reviewBody) => {
    const service = await getServiceById(serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }

    const hasReviewed = await Review.findOne({
        targetId: serviceId,
        sourceId: reviewBody.sourceId,
        customerId: reviewBody.customerId
    });
    if (hasReviewed) {
        throw new ApiError(status.BAD_REQUEST, 'You have already reviewed this service');
    }

    const user = await User.findById(reviewBody.customerId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    const booking = await Booking.findById(reviewBody.sourceId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    if (booking.customerId.toString() !== reviewBody.customerId.toString()) {
        throw new ApiError(status.FORBIDDEN, 'You are not authorized to review this booking');
    }
    if (booking.serviceId.toString() !== serviceId.toString()) {
        throw new ApiError(status.FORBIDDEN, 'This booking does not belong to this service');
    }
    if (booking.status !== 'completed') {
        throw new ApiError(status.FORBIDDEN, 'You can only review completed bookings');
    }

    const review = await Review.create({
        targetType: 'service',
        targetId: serviceId,
        sourceType: 'booking',
        sourceId: reviewBody.sourceId,
        customerId: reviewBody.customerId,
        rating: reviewBody.rating,
        content: reviewBody.content,
        photos: reviewBody.photos,
        customerName: user.fullname,
        customerAvatar: user.avatar,
    });

    // Update the service's recent reviews
    service.recentReviews.push(review._id);
    service.ratings.count = Number.parseInt(service.ratings.count) + 1;
    service.ratings.totalStars = Number.parseInt(service.ratings.totalStars) + Number.parseInt(reviewBody.rating);
    service.ratings.average = Math.round((service.ratings.totalStars / service.ratings.count) * 10) / 10;
    await service.save();

    return review;
}

/**
 * Get service statistics
 * @returns {Promise<Object>} - Service statistics
 */
const getServiceStatistics = async () => {
    // Total number of services
    const totalServices = await Service.countDocuments({isVisible: true});

    // Service distribution by pet type
    const petTypeDistribution = await Service.aggregate([
        {$match: {isVisible: true}},
        {$unwind: '$petTypes'},
        {
            $group: {
                _id: '$petTypes',
                count: {$sum: 1}
            }
        },
        {$sort: {count: -1}}
    ]);

    return {
        totalServices,
        petTypeDistribution
    };
};

/**
 * Get repeat service usage rate based on completed bookings
 * @returns {Promise<Object>} - Repeat usage statistics
 */
const getRepeatServiceUsage = async () => {
    // Get customers who have completed bookings
    const customerBookings = await Booking.aggregate([
        {$match: {status: 'completed'}},
        {
            $group: {
                _id: {
                    customerId: '$customerId',
                    serviceId: '$serviceId'
                },
                bookingCount: {$sum: 1}
            }
        },
        {
            $group: {
                _id: '$_id.customerId',
                services: {
                    $push: {
                        serviceId: '$_id.serviceId',
                        bookingCount: '$bookingCount'
                    }
                },
                totalBookings: {$sum: '$bookingCount'}
            }
        }
    ]);

    let totalCustomers = 0;
    let repeatCustomers = 0;
    let totalBookings = 0;
    let repeatBookings = 0;

    customerBookings.forEach(customer => {
        totalCustomers++;
        totalBookings += customer.totalBookings;

        const hasRepeatService = customer.services.some(service => service.bookingCount > 1);
        if (hasRepeatService) {
            repeatCustomers++;
            customer.services.forEach(service => {
                if (service.bookingCount > 1) {
                    repeatBookings += service.bookingCount - 1;
                }
            });
        }
    });

    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100).toFixed(2) : 0;
    const repeatBookingRate = totalBookings > 0 ? (repeatBookings / totalBookings * 100).toFixed(2) : 0;

    return {
        totalCustomers,
        repeatCustomers,
        repeatCustomerRate,
        totalBookings,
        repeatBookings,
        repeatBookingRate
    };
};

/**
 * Get peak hours statistics based on completed bookings
 * @returns {Promise<Object>} - Peak hours statistics
 */
const getPeakHoursStatistics = async () => {
    const bookings = await Booking.find({status: 'completed'}).select('timeSlot bookingDate');

    const hourCounts = {};
    const dayOfWeekCounts = {
        0: 0, // Sunday
        1: 0, // Monday
        2: 0, // Tuesday
        3: 0, // Wednesday
        4: 0, // Thursday
        5: 0, // Friday
        6: 0  // Saturday
    };

    // Initialize hour counts (0-23)
    for (let i = 0; i < 24; i++) {
        hourCounts[i] = 0;
    }

    bookings.forEach(booking => {
        // Extract hour from timeSlot (format: "HH:MM-HH:MM")
        const startTime = booking.timeSlot.split('-')[0];
        const hour = parseInt(startTime.split(':')[0]);

        hourCounts[hour]++;

        // Count by day of week
        const dayOfWeek = booking.bookingDate.getDay();
        dayOfWeekCounts[dayOfWeek]++;
    });

    // Find peak hour
    const peakHour = Object.keys(hourCounts).reduce((a, b) =>
        hourCounts[a] > hourCounts[b] ? a : b
    );

    // Find peak day of week
    const peakDayOfWeek = Object.keys(dayOfWeekCounts).reduce((a, b) =>
        dayOfWeekCounts[a] > dayOfWeekCounts[b] ? a : b
    );

    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

    return {
        hourlyDistribution: hourCounts,
        peakHour: parseInt(peakHour),
        peakHourBookings: hourCounts[peakHour],
        weeklyDistribution: dayOfWeekCounts,
        peakDayOfWeek: parseInt(peakDayOfWeek),
        peakDayName: dayNames[peakDayOfWeek],
        peakDayBookings: dayOfWeekCounts[peakDayOfWeek]
    };
};

module.exports = {
    createService,
    getServiceById,
    getAllServices,
    getFeaturedServices,
    getSaleServices,
    getServicesByCategory,
    updateServiceById,
    deleteServiceById,
    searchServices,
    getServicesByPetType,
    toggleServiceFeatured,
    toggleServiceVisible,
    updateServiceAvailability,
    updateServiceImages,
    getServiceAvailableTimeslots,
    getReviewsByServiceId,
    createReview,
    getServiceStatistics,
    getRepeatServiceUsage,
    getPeakHoursStatistics
};
