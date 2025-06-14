const {status} = require('http-status');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcrypt');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
    if (await User.findOne({email: userBody.email})) {
        throw new ApiError(status.BAD_REQUEST, 'Email already taken');
    }

    // Hash password if provided
    if (userBody.password) {
        const salt = await bcrypt.genSalt(10);
        userBody.passwordHash = await bcrypt.hash(userBody.password, salt);
        delete userBody.password;
    }

    return User.create(userBody);
};

/**
 * Get all users
 * @param {Object} filter
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} options.sortBy
 * @param {string} options.sortOrder
 * @returns {Promise<Object>}
 */
const getUsers = async (filter, options) => {
    const {page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'asc'} = options;
    const skip = (page - 1) * limit;

    // Construct sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

    const totalUsers = await User.countDocuments(filter);

    return {
        users,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        totalResults: totalUsers
    };
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
    return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
    return User.findOne({email});
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @param {Object} currentUser
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody, currentUser) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // Hash password if provided
    if (updateBody.password) {
        const salt = await bcrypt.genSalt(10);
        updateBody.passwordHash = await bcrypt.hash(updateBody.password, salt);
        delete updateBody.password;
    }

    Object.assign(user, updateBody);
    await user.save();
    return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }
    user.isBanned = true;
    await user.save();
    return user;
};

/**
 * Add address to user
 * @param {ObjectId} userId
 * @param {Object} addressData - Bao gồm địa chỉ chi tiết, xã, huyện, thành phố
 * @returns {Promise<User>}
 */
const addUserAddress = async (userId, addressData) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // If this is set as default, unset any existing default address
    if (addressData.isDefault) {
        user.addresses.forEach(addr => {
            addr.isDefault = false;
        });
    }

    if (user.addresses.length === 0) {
        addressData.isDefault = true;
    }

    // Tạo object địa chỉ mới với các trường chi tiết
    const newAddress = {
        fullName: addressData.fullName,
        phone: addressData.phone,
        streetAddress: addressData.streetAddress,
        ward: addressData.ward,
        district: addressData.district,
        city: addressData.city,
        isDefault: addressData.isDefault || false
    };

    user.addresses.push(newAddress);
    await user.save();
    return user;
};

/**
 * Update user address by id
 * @param {ObjectId} userId
 * @param {ObjectId} addressId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserAddress = async (userId, addressId, updateBody) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Address not found');
    }

    // If setting as default, unset any existing default address
    if (updateBody.isDefault) {
        user.addresses.forEach(addr => {
            addr.isDefault = false;
        });
    }

    Object.assign(user.addresses[addressIndex], updateBody);
    await user.save();
    return user;
};

/**
 * Delete user address
 * @param {ObjectId} userId
 * @param {ObjectId} addressId
 * @returns {Promise<User>}
 */
const deleteUserAddress = async (userId, addressId) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Address not found');
    }

    user.addresses.splice(addressIndex, 1);
    await user.save();
    return user;
};

/**
 * Get address by ID
 * @param {ObjectId} userId
 * @param {string} addressId
 * @returns {Promise<Object>}
 */
const getAddressById = async (userId, addressId) => {
    const user = await getUserById(userId);

    const address = user.addresses.find((addr) => addr._id.toString() === addressId);

    if (!address) {
        throw new ApiError(status.NOT_FOUND, 'Address not found');
    }

    return address;
};

/**
 * Check if password matches
 * @param {object} user
 * @param {string} password
 * @returns {Promise<boolean>}
 */
const isPasswordMatch = async (user, password) => {
    return bcrypt.compare(password, user.passwordHash);
};

const banOrUnbanUser = async (userId, isBanned) => {
    const user = await getUserById(userId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }
    user.isBanned = isBanned;
    await user.save();
    return user;
};

/**
 * Thống kê số lượng người dùng mới theo ngày/tháng/năm
 * @param {Object} options - Các tùy chọn thống kê
 * @param {String} [options.period='month'] - Khoảng thời gian: 'day', 'month', 'year'
 * @returns {Promise<Object>} Kết quả thống kê
 */
const getUserStatistics = async (options = {}) => {
    const {period = 'month'} = options;

    // Xác định khoảng thời gian dựa trên period
    const currentDate = new Date();
    let startDate, endDate, groupBy, dateFormat, dateField;

    switch (period) {
        case 'day':
            // Thống kê trong ngày hiện tại (00:00:00 đến hiện tại)
            startDate = new Date(currentDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = currentDate;
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"},
                day: {$dayOfMonth: "$createdAt"},
                hour: {$hour: "$createdAt"}
            };
            dateFormat = "%H:00";
            dateField = "hour";
            break;
        case 'year':
            // Thống kê trong năm hiện tại
            startDate = new Date(currentDate.getFullYear(), 0, 1); // Ngày đầu tiên của năm
            endDate = currentDate;
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"}
            };
            dateFormat = "%m";
            dateField = "month";
            break;
        case 'month':
        default:
            // Thống kê trong tháng hiện tại
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); // Ngày đầu tiên của tháng
            endDate = currentDate;
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"},
                day: {$dayOfMonth: "$createdAt"}
            };
            dateFormat = "%d";
            dateField = "day";
    }

    // Query các người dùng đăng ký trong khoảng thời gian
    const newUsersQuery = {
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    };

    // Tổng số người dùng mới trong khoảng thời gian
    const newUsersCount = await User.countDocuments(newUsersQuery);

    // Tổng số người dùng tính đến hiện tại
    const totalUsersCount = await User.countDocuments({
        createdAt: {$lte: endDate}
    });

    // Thống kê chi tiết theo giờ/ngày/tháng
    const detailedStats = await User.aggregate([
        {
            $match: newUsersQuery
        },
        {
            $group: {
                _id: groupBy,
                count: {$sum: 1}
            }
        },
        {
            $sort: {
                "_id.year": 1,
                "_id.month": 1,
                "_id.day": 1,
                "_id.hour": 1
            }
        }
    ]);

    // Định nghĩa tên tháng tiếng Việt
    const monthNamesVI = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    // Xử lý kết quả thành định dạng mong muốn
    const formattedStats = detailedStats.map(record => {
        let label;

        switch (period) {
            case 'day':
                label = `${ String(record._id.hour).padStart(2, '0') }:00`;
                break;
            case 'year':
                label = monthNamesVI[record._id.month - 1];
                break;
            case 'month':
            default:
                label = `${ String(record._id.day).padStart(2, '0') }`;
        }

        return {
            [dateField]: label,
            newUsers: record.count
        };
    });

    return {
        period: {
            type: period,
            start: startDate,
            end: endDate
        },
        summary: {
            totalUsers: totalUsersCount,
            newUsers: newUsersCount
        },
        data: formattedStats
    };
};

/**
 * Phân tích tăng trưởng người dùng
 * @param {Object} options - Các tùy chọn phân tích
 * @param {String} [options.period='month'] - Khoảng thời gian: 'day', 'month', 'year'
 * @param {Number} [options.months=6] - Số tháng cần phân tích (chỉ cho dự đoán)
 * @returns {Promise<Object>} Kết quả phân tích
 */
const analyzeUserGrowth = async (options = {}) => {
    const {period = 'month'} = options;

    // Xác định khoảng thời gian dựa trên period
    const endDate = new Date();
    let startDate = new Date();
    let groupBy, dateFormat;

    switch (period) {
        case 'day':
            // 24 giờ gần nhất
            startDate.setHours(startDate.getHours() - 24);
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"},
                day: {$dayOfMonth: "$createdAt"},
                hour: {$hour: "$createdAt"}
            };
            dateFormat = "hour";
            break;
        case 'year':
            // 12 tháng gần nhất
            startDate.setMonth(startDate.getMonth() - 12);
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"}
            };
            dateFormat = "month";
            break;
        case 'month':
        default:
            // 30 ngày gần nhất
            startDate.setDate(startDate.getDate() - 30);
            groupBy = {
                year: {$year: "$createdAt"},
                month: {$month: "$createdAt"},
                day: {$dayOfMonth: "$createdAt"}
            };
            dateFormat = "day";
    }

    // Truy vấn dữ liệu người dùng theo khoảng thời gian
    const usersGrowth = await User.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        },
        {
            $group: {
                _id: groupBy,
                count: {$sum: 1}
            }
        },
        {
            $sort: {
                "_id.year": 1,
                "_id.month": 1,
                "_id.day": 1,
                "_id.hour": 1
            }
        }
    ]);

    // Định nghĩa tên tháng tiếng Việt
    const monthNamesVI = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    // Xử lý kết quả thành định dạng mong muốn
    const chartData = usersGrowth.map(record => {
        switch (dateFormat) {
            case "hour":
                return {
                    hour: `${ String(record._id.hour).padStart(2, '0') }:00`,
                    users: record.count
                };
            case "month":
                return {
                    month: monthNamesVI[record._id.month - 1],
                    users: record.count
                };
            case "day":
            default:
                return {
                    day: `${ String(record._id.day).padStart(2, '0') }/${ String(record._id.month).padStart(2, '0') }`,
                    users: record.count
                };
        }
    });

    // Tổng số người dùng mới trong khoảng thời gian
    const totalNewUsers = chartData.reduce((sum, item) => sum + item.users, 0);

    return {
        period: {
            type: period,
            start: startDate,
            end: endDate
        },
        data: chartData,
        totalNewUsers
    };
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return {startDate, endDate, prevStartDate, prevEndDate};
};

const getUserAnalytics = async (period, year, month, day) => {
    const {startDate, endDate, prevStartDate, prevEndDate} = getDateRanges(period, year, month, day);

    // Total users (role: 'user')
    const totalUsers = await User.countDocuments({role: 'user'});

    // New users in current period
    const newUsers = await User.countDocuments({
        role: 'user',
        createdAt: {$gte: startDate, $lte: endDate}
    });

    // New users in previous period
    const prevNewUsers = await User.countDocuments({
        role: 'user',
        createdAt: {$gte: prevStartDate, $lte: prevEndDate}
    });

    return {
        totalUsers,
        current: {
            newUsers
        },
        previous: {
            newUsers: prevNewUsers
        },
        growth: {
            newUsersGrowth: prevNewUsers > 0
                ? ((newUsers - prevNewUsers) / prevNewUsers * 100).toFixed(2)
                : newUsers > 0 ? 100 : 0
        }
    };
};

/**
 * Get user preferences for agent personalization
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
const getUserPreferencesForAgent = async (userId) => {
    const user = await getUserById(userId);
    if (!user) {
        return null;
    }

    // Get user's order history for recommendations
    const orderService = require('./order.service');
    const orderHistory = await orderService.getOrdersByCustomerId(userId, {limit: 5});

    // Get user's booking history
    const bookingService = require('./booking.service');
    const bookingHistory = await bookingService.getBookingsByCustomerId(userId, {limit: 5});

    return {
        profile: {
            fullname: user.fullname,
            email: user.email,
            phone: user.phone,
            addresses: user.addresses
        },
        preferences: {
            recentOrders: orderHistory.results,
            recentBookings: bookingHistory.results,
            totalOrders: orderHistory.totalResults,
            totalBookings: bookingHistory.totalResults
        }
    };
};

module.exports = {
    createUser,
    getUsers,
    getUserById,
    getUserByEmail,
    updateUserById,
    deleteUserById,
    addUserAddress,
    updateUserAddress,
    deleteUserAddress,
    getAddressById,
    isPasswordMatch,
    banOrUnbanUser,
    getUserStatistics,
    analyzeUserGrowth,
    getUserAnalytics,
    getUserPreferencesForAgent
};