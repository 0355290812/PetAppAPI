const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {serviceService} = require('../services');
const ApiError = require('../utils/ApiError');
const {getFilePath} = require('../configs/multer');

const createService = catchAsync(async (req, res) => {
    const images = req.files.map((file) => {
        const filePath = getFilePath(file);
        return filePath;
    });
    req.body.images = images;

    const service = await serviceService.createService(req.body);
    res.status(status.CREATED).send(service);
});

const getServices = catchAsync(async (req, res) => {
    // Build filter object from query parameters
    const filter = {};

    // Pagination and sorting options
    const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sort: req.query.sort || '-createdAt'
    };

    // Apply filters

    // Price range filters
    if (req.query.minPrice !== undefined) {
        filter.price = {...filter.price, $gte: Number(req.query.minPrice)};
    }
    if (req.query.maxPrice !== undefined) {
        filter.price = {...filter.price, $lte: Number(req.query.maxPrice)};
    }

    // Duration range filters
    if (req.query.minDuration !== undefined) {
        filter.duration = {...filter.duration, $gte: Number(req.query.minDuration)};
    }
    if (req.query.maxDuration !== undefined) {
        filter.duration = {...filter.duration, $lte: Number(req.query.maxDuration)};
    }

    // Rating filters
    if (req.query.minRating !== undefined) {
        filter['ratings.average'] = {...filter['ratings.average'], $gte: Number(req.query.minRating)};
    }
    if (req.query.maxRating !== undefined) {
        filter['ratings.average'] = {...filter['ratings.average'], $lte: Number(req.query.maxRating)};
    }

    // Pet types filter
    if (req.query.petTypes) {
        const petTypesArray = Array.isArray(req.query.petTypes)
            ? req.query.petTypes
            : req.query.petTypes.split(',');
        filter.petTypes = {$in: petTypesArray};
    }

    // Boolean filters
    if (req.query.onSale !== undefined) {
        filter.onSale = req.query.onSale === 'true';
    }
    if (req.query.isFeatured !== undefined) {
        filter.isFeatured = req.query.isFeatured === 'true';
    }
    if (req.query.isVisible !== undefined) {
        filter.isVisible = req.query.isVisible === 'true';
    }

    // Name search (partial match, ensure case-insensitivity)
    if (req.query.name) {
        filter.name = {$regex: req.query.name, $options: 'i'};
    }

    // Text search across multiple fields
    if (req.query.search) {
        filter.$text = {$search: req.query.search};
    }

    // Capacity filter
    if (req.query.minCapacity) {
        filter.capacity = {...filter.capacity, $gte: Number(req.query.minCapacity)};
    }

    if (req.user.role === 'user') {
        filter.isVisible = true;
    }

    const result = await serviceService.getAllServices(filter, options);
    res.send(result);
});

const getService = catchAsync(async (req, res) => {
    const service = await serviceService.getServiceById(req.params.serviceId);
    if (!service) {
        throw new ApiError(status.NOT_FOUND, 'Service not found');
    }
    res.send(service);
});

const getFeaturedServices = catchAsync(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const services = await serviceService.getFeaturedServices(limit);
    res.send(services);
});

const getServicesByCategory = catchAsync(async (req, res) => {
    const options = req.query.options ? JSON.parse(req.query.options) : {};
    const result = await serviceService.getServicesByCategory(req.params.categoryId, options);
    res.send(result);
});

const updateService = catchAsync(async (req, res) => {
    const images = req.files.map(file => {
        const filePath = getFilePath(file);
        return filePath
    });

    const oldImages = req.body.existingImages || [];
    const allImages = [...oldImages, ...images];

    const updateData = images.length > 0 ? {...req.body, images: allImages} : req.body;
    const service = await serviceService.updateServiceById(req.params.serviceId, updateData);
    res.send(service);
});

const deleteService = catchAsync(async (req, res) => {
    await serviceService.deleteServiceById(req.params.serviceId);
    res.status(status.NO_CONTENT).send();
});

const searchServices = catchAsync(async (req, res) => {
    const searchQuery = req.query.query || '';
    const filter = {};

    // Pagination and sorting options
    const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sort: req.query.sort || 'score' // Default to relevance score for search
    };

    // Apply filters

    // Price range filters
    if (req.query.minPrice !== undefined) {
        filter.price = {...filter.price, $gte: Number(req.query.minPrice)};
    }
    if (req.query.maxPrice !== undefined) {
        filter.price = {...filter.price, $lte: Number(req.query.maxPrice)};
    }

    // Duration range filters
    if (req.query.minDuration !== undefined) {
        filter.duration = {...filter.duration, $gte: Number(req.query.minDuration)};
    }
    if (req.query.maxDuration !== undefined) {
        filter.duration = {...filter.duration, $lte: Number(req.query.maxDuration)};
    }

    // Pet types filter
    if (req.query.petTypes) {
        const petTypesArray = Array.isArray(req.query.petTypes)
            ? req.query.petTypes
            : req.query.petTypes.split(',');
        filter.petTypes = {$in: petTypesArray};
    }

    // Boolean filters
    if (req.query.onSale !== undefined) {
        filter.onSale = req.query.onSale === 'true';
    }

    const result = await serviceService.searchServices(searchQuery, filter, options);
    res.send(result);
});

const getServicesByPetType = catchAsync(async (req, res) => {
    const options = req.query.options ? JSON.parse(req.query.options) : {};
    const result = await serviceService.getServicesByPetType(req.params.petType, options);
    res.send(result);
});

const toggleFeatured = catchAsync(async (req, res) => {
    const service = await serviceService.toggleServiceFeatured(req.params.serviceId);
    res.send(service);
});

const updateServiceAvailability = catchAsync(async (req, res) => {
    const service = await serviceService.updateServiceAvailability(req.params.serviceId, req.body);
    res.send(service);
});

const toggleServiceVisible = catchAsync(async (req, res) => {
    const service = await serviceService.toggleServiceVisible(req.params.serviceId);
    res.send(service);
});

const getSaleServices = catchAsync(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const services = await serviceService.getSaleServices(limit);
    res.send(services);
});

const getServiceTimeslots = catchAsync(async (req, res) => {
    const serviceId = req.params.serviceId;
    const availableTimeslots = await serviceService.getServiceAvailableTimeslots(serviceId);
    res.send(availableTimeslots);
});

const getReviewsByServiceId = catchAsync(async (req, res) => {
    const serviceId = req.params.serviceId;
    const reviews = await serviceService.getReviewsByServiceId(serviceId);
    res.send(reviews);
});

const createServiceReview = catchAsync(async (req, res) => {
    const photos = req.files?.map((file) => {
        const filePath = getFilePath(file);
        return filePath;
    });
    req.body.photos = photos;
    req.body.customerId = req.user._id;
    const serviceId = req.params.serviceId;
    const review = await serviceService.createReview(serviceId, req.body);
    res.status(status.CREATED).send(review);
});

const getServiceStatistics = catchAsync(async (req, res) => {
    const statistics = await serviceService.getServiceStatistics();
    res.send({
        success: true,
        data: statistics
    });
});

const getRepeatServiceUsage = catchAsync(async (req, res) => {
    const repeatUsage = await serviceService.getRepeatServiceUsage();
    res.send({
        success: true,
        data: repeatUsage
    });
});

const getPeakHoursStatistics = catchAsync(async (req, res) => {
    const peakHours = await serviceService.getPeakHoursStatistics();
    res.send({
        success: true,
        data: peakHours
    });
});

module.exports = {
    createService,
    getServices,
    getService,
    getFeaturedServices,
    getServicesByCategory,
    updateService,
    deleteService,
    searchServices,
    getServicesByPetType,
    toggleFeatured,
    updateServiceAvailability,
    toggleServiceVisible,
    getSaleServices,
    getServiceTimeslots,
    getReviewsByServiceId,
    createServiceReview,
    getServiceStatistics,
    getRepeatServiceUsage,
    getPeakHoursStatistics
};
