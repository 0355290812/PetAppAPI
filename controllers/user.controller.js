const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {userService} = require('../services');
const ApiError = require('../utils/ApiError');
const {getFilePath} = require('../configs/multer');

const createUser = catchAsync(async (req, res) => {
    const user = await userService.createUser(req.body);
    res.status(status.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
    const {
        search, role, banned, sort, page = 1, limit = 10
    } = req.query;

    // Xây dựng filter
    const filter = {};

    if (search) {
        filter.$or = [
            {email: {$regex: search, $options: 'i'}},
            {fullname: {$regex: search, $options: 'i'}},
            {phone: {$regex: search, $options: 'i'}}
        ];
    }

    if (role) filter.role = role;
    if (banned === 'true') filter.isBanned = true;
    if (banned === 'false') filter.isBanned = false;

    if (req.user.role === 'staff') {
        filter.role = "user";
        filter.isBanned = false;
    }

    // Không lấy thông tin của chính mình
    filter._id = {$ne: req.user._id};

    // Xây dựng options
    const options = {
        page: page && !isNaN(parseInt(page, 10)) ? parseInt(page, 10) : 1,
        limit: limit && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : 10
    };

    if (sort) {
        const [field, order] = sort.split(':');
        options.sortBy = field;
        options.sortOrder = order || 'asc';
    }

    const result = await userService.getUsers(filter, options);
    res.send(result);
});

const getUser = catchAsync(async (req, res) => {
    const {_id, email, fullname, phone, role, avatar, isBanned, createdAt} = await userService.getUserById(req.params.userId);

    if (!email) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }
    res.send({
        _id,
        email,
        fullname,
        phone,
        role,
        avatar,
        isBanned,
        createdAt
    });
    // const user = await userService.getUserById(req.params.userId);
    // if (!user) {
    //     throw new ApiError(status.NOT_FOUND, 'User not found');
    // }
    // res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
    const user = await userService.updateUserById(req.params.userId, req.body);
    res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
    await userService.deleteUserById(req.params.userId);
    res.status(status.NO_CONTENT).send({
        message: 'User deleted successfully'
    });
});

const banOrUnbanUser = catchAsync(async (req, res) => {
    const user = await userService.banOrUnbanUser(req.params.userId, req.body.isBanned);
    res.send(user);
});

const updateRole = catchAsync(async (req, res) => {
    const user = await userService.updateUserById(req.params.userId, req.body);
    res.send(user);
});

// Address management
const getUserAddresses = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }
    res.send(user.addresses || []);
});

const addAddress = catchAsync(async (req, res) => {
    const user = await userService.addUserAddress(req.user.id, req.body);
    res.status(status.CREATED).send(user.addresses[user.addresses.length - 1]);
});

const updateAddress = catchAsync(async (req, res) => {
    const user = await userService.updateUserAddress(req.user.id, req.params.addressId, req.body);
    const updatedAddress = user.addresses.find(addr => addr._id.toString() === req.params.addressId);
    res.send(updatedAddress);
});

const deleteAddress = catchAsync(async (req, res) => {
    await userService.deleteUserAddress(req.user.id, req.params.addressId);
    res.status(status.NO_CONTENT).send();
});

/**
 * Get address by id
 * @param {Object} req
 * @param {Object} res
 * @returns {Promise<Object>}
 */
const getAddress = catchAsync(async (req, res) => {
    const address = await userService.getAddressById(req.user.id, req.params.addressId);
    res.send(address);
});

const getProfile = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }
    res.send(user);
});

const updateProfile = catchAsync(async (req, res) => {
    // Don't allow role update through this endpoint
    if (req.body.role) {
        delete req.body.role;
    }

    const user = await userService.updateUserById(req.user._id, req.body, req.user);
    res.send(user);
});

/**
 * Get user registration statistics by day/month/year
 * @route GET /api/users/statistics
 * @access Admin/Staff only
 */
const getUserStats = catchAsync(async (req, res) => {
    const options = {};

    // Parse period parameter (day, month, year)
    const validPeriods = ['day', 'month', 'year'];
    const period = req.query.period || 'month'; // Default to month if not specified

    if (!validPeriods.includes(period)) {
        throw new ApiError(status.BAD_REQUEST, 'Invalid period parameter. Must be day, month, or year.');
    }

    options.period = period;

    const statistics = await userService.getUserStatistics(options);
    res.send(statistics);
});

/**
 * Get user growth analysis and predictions
 * @route GET /api/users/growth-analysis
 * @access Admin only
 */
const getGrowthAnalysis = catchAsync(async (req, res) => {
    const options = {};

    // Parse period parameter (day, month, year)
    const validPeriods = ['day', 'month', 'year'];
    const period = req.query.period || 'month'; // Default to month if not specified

    if (!validPeriods.includes(period)) {
        throw new ApiError(status.BAD_REQUEST, 'Invalid period parameter. Must be day, month, or year.');
    }

    options.period = period;

    // Parse months parameter if provided (for prediction purposes)
    if (req.query.months) {
        const months = parseInt(req.query.months);
        if (!isNaN(months) && months > 0) {
            options.months = months;
        } else {
            throw new ApiError(status.BAD_REQUEST, 'Invalid months parameter. Must be a positive number.');
        }
    }

    const growthAnalysis = await userService.analyzeUserGrowth(options);
    res.send(growthAnalysis);
});

const changeAvatar = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // Update avatar
    const avatarPath = getFilePath(req.file);
    await userService.updateUserById(req.user._id, {avatar: avatarPath}, req.user);
    res.send({avatar: avatarPath});
});

const getUserAnalytics = catchAsync(async (req, res) => {
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const {period, year, month, day} = req.query;
    const analytics = await userService.getUserAnalytics(period, year, month, day);

    res.send({
        success: true,
        data: analytics
    });
});

module.exports = {
    createUser,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    updateRole,
    getProfile,
    updateProfile,
    getUserAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    getAddress,
    banOrUnbanUser,
    getUserStats,
    getGrowthAnalysis,
    changeAvatar,
    getUserAnalytics
};
