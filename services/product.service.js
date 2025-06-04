const {status} = require('http-status');
const Product = require('../models/product.model');
const ApiError = require('../utils/ApiError');
const Review = require('../models/review.model');
const User = require('../models/user.model');

/**
 * Create a product
 * @param {Object} productBody
 * @returns {Promise<Product>}
 */
const createProduct = async (productBody) => {
    return Product.create(productBody);
};

/**
 * Get product by id
 * @param {ObjectId} id
 * @returns {Promise<Product>}
 */
const getProductById = async (id) => {
    return Product.findById(id)
        .populate('categoryId')
        .populate({
            path: 'recentReviews',
            populate: {
                path: 'customerId',
            }
        });
};

/**
 * Get all products
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page
 * @param {number} [options.page] - Current page
 * @returns {Promise<Object>} - Object containing products and pagination info
 */
const getAllProducts = async (filter = {}, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 12;
    const skip = (page - 1) * limit;

    // Parse sortBy option (e.g. "createdAt:desc,price:asc")
    let sort = {};
    if (options.sortBy) {
        const sortFields = options.sortBy.split(',');
        sortFields.forEach(field => {
            const [key, value] = field.split(':');
            sort[key] = value === 'desc' ? -1 : 1;
        });
    } else {
        sort = {createdAt: -1};
    }

    // Create projection for optimized queries
    const projection = {
        name: 1,
        description: 1,
        price: 1,
        salePrice: 1,
        images: {$slice: 1}, // Only return the first image for listings
        ratings: 1,
        onSale: 1,
        stock: 1,
        brand: 1,
        categoryId: 1,
        isVisible: 1,
        isFeatured: 1,
        tags: 1,
    };

    const [products, totalResults] = await Promise.all([
        Product.find(filter, projection)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Product.countDocuments(filter)
    ]);

    return {
        results: products,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Get featured products
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Product[]>}
 */
const getFeaturedProducts = async (limit = 10) => {
    return Product.find({isActive: true, isFeatured: true})
        .sort({createdAt: -1})
        .limit(limit);
};

/**
 * Get products by category
 * @param {ObjectId} categoryId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing products and pagination info
 */
const getProductsByCategory = async (categoryId, options = {}) => {
    return getAllProducts({categoryId, isActive: true}, options);
};

/**
 * Get products reviews
 * @param {ObjectId} productId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing reviews and pagination info
 */
const getProductReviews = async (productId, options = {}) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({targetId: productId})
        .populate('customerId')
        .populate({
            path: 'reply',
            populate: {
                path: 'staffId',
            }
        })
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .lean();
    const totalResults = await Review.countDocuments({targetId: productId});
    const totalPages = Math.ceil(totalResults / limit);

    return {
        results: reviews,
        page,
        limit,
        totalPages: totalPages,
        totalResults: totalResults
    };
}

/**
 * Update product by id
 * @param {ObjectId} productId
 * @param {Object} updateBody
 * @returns {Promise<Product>}
 */
const updateProductById = async (productId, updateBody) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    Object.assign(product, updateBody);
    await product.save();
    return product;
};

/**
 * Delete product by id
 * @param {ObjectId} productId
 * @returns {Promise<Product>}
 */
const deleteProductById = async (productId) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    await product.deleteOne();
    return product;
};

/**
 * Search products
 * @param {string} query - Search term
 * @param {Object} options - Additional search options (category, filters, etc.)
 * @returns {Promise<Object>} - Object containing products and pagination info
 */
const searchProducts = async (query, options = {}) => {
    const filter = {
        $text: {$search: query},
        isActive: true
    };

    // Add category filter if provided
    if (options.categoryId) {
        filter.categoryId = options.categoryId;
    }

    // Add pet type filter if provided
    if (options.petType) {
        filter.petTypes = options.petType;
    }

    return getAllProducts(filter, options);
};

/**
 * Update product stock
 * @param {ObjectId} productId
 * @param {number} quantity - Amount to adjust (positive or negative)
 * @returns {Promise<Product>}
 */
const updateProductStock = async (productId, quantity) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    product.stock += quantity;
    if (product.stock < 0) {
        throw new ApiError(status.BAD_REQUEST, 'Insufficient stock');
    }

    await product.save();
    return product;
};

/**
 * Get products on sale
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing products and pagination info
 */
const getProductsOnSale = async (options = {}) => {
    return getAllProducts({onSale: true, isActive: true}, options);
};

/**
 * Toggle product featured status
 * @param {ObjectId} productId
 * @returns {Promise<Product>}
 */
const toggleProductFeatured = async (productId) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    product.isFeatured = !product.isFeatured;
    await product.save();
    return product;
};


/**
 * Create review for a product
 * @param {ObjectId} productId
 * @param {Object} reviewBody
 * @returns {Promise<Review>}
 */
const createReview = async (productId, reviewBody) => {
    const product = await getProductById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    const hasReviewed = await Review.findOne({
        targetType: 'product',
        targetId: productId,
        sourceId: reviewBody.sourceId,
        customerId: reviewBody.customerId
    });

    if (hasReviewed) {
        throw new ApiError(status.BAD_REQUEST, 'You have already reviewed this product');
    }

    const user = await User.findById(reviewBody.customerId);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // Kiểm tra xem người dùng đã mua sản phẩm này chưa
    const Order = require('../models/order.model');
    const order = await Order.findById(reviewBody.sourceId);
    if (!order) {
        throw new ApiError(status.NOT_FOUND, 'Order not found');
    }

    // Kiểm tra xem đơn hàng có thuộc về người dùng không
    if (order.customerId.toString() !== reviewBody.customerId.toString()) {
        throw new ApiError(status.FORBIDDEN, 'You are not authorized to review this order');
    }

    // Kiểm tra xem đơn hàng có chứa sản phẩm không
    const hasProduct = order.items.some(item => item.productId.toString() === productId.toString());
    if (!hasProduct) {
        throw new ApiError(status.FORBIDDEN, 'This order does not contain this product');
    }

    // Kiểm tra xem đơn hàng đã giao hàng chưa
    if (order.status !== 'delivered') {
        throw new ApiError(status.FORBIDDEN, 'You can only review products from delivered orders');
    }

    const review = await Review.create({
        targetType: 'product',
        targetId: productId,
        sourceType: 'order',
        sourceId: reviewBody.sourceId,
        customerId: reviewBody.customerId,
        rating: reviewBody.rating,
        content: reviewBody.content,
        photos: reviewBody.photos,
        customerName: user.fullname,
        customerAvatar: user.avatar,
    });

    // Cập nhật thông tin đánh giá của sản phẩm
    product.recentReviews.push(review._id);
    if (!product.ratings) {
        product.ratings = {count: 0, totalStars: 0, average: 0};
    }

    product.ratings.count = Number.parseInt(product.ratings.count) + 1;
    product.ratings.totalStars = Number.parseInt(product.ratings.totalStars) + Number.parseInt(reviewBody.rating);
    product.ratings.average = Math.round((product.ratings.totalStars / product.ratings.count) * 10) / 10;

    await product.save();

    return review;
};

/**
 * Get product statistics
 * @returns {Promise<Object>}
 */
const getProductStats = async () => {
    const [
        totalProducts,
        visibleProducts,
        outOfStockCount,
        lowStockCount,
        onSaleCount,
        featuredCount
    ] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({isVisible: true}),
        Product.countDocuments({stock: 0}),
        Product.countDocuments({stock: {$gt: 0, $lt: 10}}),
        Product.countDocuments({onSale: true}),
        Product.countDocuments({isFeatured: true})
    ]);

    const totalValue = await Product.aggregate([
        {
            $group: {
                _id: null,
                totalValue: {
                    $sum: {$multiply: ['$stock', '$price']}
                }
            }
        }
    ]);

    return {
        totalProducts,
        visibleProducts,
        outOfStockCount,
        lowStockCount,
        onSaleCount,
        featuredCount,
        totalInventoryValue: Math.round((totalValue[0]?.totalValue || 0) * 100) / 100
    };
};

/**
 * Get product distribution by pet types
 * @returns {Promise<Array>}
 */
const getProductDistributionByPetTypes = async () => {
    const distribution = await Product.aggregate([
        {$match: {isVisible: true}},
        {$unwind: '$petTypes'},
        {
            $group: {
                _id: '$petTypes',
                count: {$sum: 1},
                totalStock: {$sum: '$stock'},
                averagePrice: {$avg: '$price'}
            }
        },
        {
            $project: {
                petType: '$_id',
                count: 1,
                totalStock: 1,
                averagePrice: {$round: ['$averagePrice', 2]},
                _id: 0
            }
        },
        {$sort: {count: -1}}
    ]);

    return distribution;
};

/**
 * Get best selling products
 * @param {number} limit - Number of products to return
 * @returns {Promise<Array>}
 */
const getBestSellingProducts = async (limit = 10) => {
    const products = await Product.find({isVisible: true})
        .select('name brand soldCount stock price images ratings')
        .sort({soldCount: -1})
        .limit(limit)
        .populate('categoryId', 'name')
        .lean();

    return products;
};

/**
 * Get out of stock products
 * @param {number} limit - Number of products to return
 * @returns {Promise<Array>}
 */
const getOutOfStockProducts = async (limit = 20) => {
    const products = await Product.find({stock: 0, isVisible: true})
        .select('name brand stock price images categoryId updatedAt')
        .populate('categoryId', 'name')
        .sort({updatedAt: -1})
        .limit(limit)
        .lean();

    return products;
};

/**
 * Get products with old inventory (not updated for more than specified days)
 * @param {number} limit - Number of products to return
 * @param {number} days - Days threshold for old inventory
 * @returns {Promise<Array>}
 */
const getOldInventoryProducts = async (limit = 20, days = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const products = await Product.find({
        isVisible: true,
        stock: {$gt: 0},
        updatedAt: {$lt: cutoffDate}
    })
        .select('name brand stock price images categoryId updatedAt')
        .populate('categoryId', 'name')
        .sort({updatedAt: 1})
        .limit(limit)
        .lean();

    return products.map(product => ({
        ...product,
        daysInStock: Math.floor((new Date() - new Date(product.updatedAt)) / (1000 * 60 * 60 * 24))
    }));
};

module.exports = {
    createProduct,
    getProductById,
    getAllProducts,
    getFeaturedProducts,
    getProductsByCategory,
    getProductReviews,
    updateProductById,
    deleteProductById,
    searchProducts,
    updateProductStock,
    getProductsOnSale,
    toggleProductFeatured,
    createReview,
    getProductStats,
    getProductDistributionByPetTypes,
    getBestSellingProducts,
    getOutOfStockProducts,
    getOldInventoryProducts,
};
