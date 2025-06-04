const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {productService, categoryService} = require('../services');
const ApiError = require('../utils/ApiError');
const {getFilePath} = require('../configs/multer');

const createProduct = catchAsync(async (req, res) => {
    const images = req.files.map(file => {
        const filePath = getFilePath(file);
        return filePath
    })

    const product = await productService.createProduct({...req.body, images});
    res.status(status.CREATED).send(product);
});

const getProducts = catchAsync(async (req, res) => {
    // Extract query parameters
    const {
        search,
        categoryId,
        petTypes,
        brand,
        minPrice,
        maxPrice,
        minRating,
        maxRating,
        onSale,
        inStock,
        isFeatured,
        isVisible,
        isLowStock,
        tags,
        sort = '-createdAt',
        page = 1,
        limit = 12
    } = req.query;

    // Build filter object
    const filter = {};

    // Text search handling
    if (search) {
        filter.$text = {$search: search};
    }

    // Category filter
    if (categoryId) filter.categoryId = categoryId;

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
        const priceConditions = [];

        // Create conditions for regular price (when not on sale)
        const regularPriceCondition = {onSale: {$ne: true}};
        if (minPrice !== undefined) {
            regularPriceCondition.price = regularPriceCondition.price || {};
            regularPriceCondition.price.$gte = Number(minPrice);
        }
        if (maxPrice !== undefined) {
            regularPriceCondition.price = regularPriceCondition.price || {};
            regularPriceCondition.price.$lte = Number(maxPrice);
        }

        // Create conditions for sale price (when on sale)
        const salePriceCondition = {onSale: true};
        if (minPrice !== undefined) {
            salePriceCondition.salePrice = salePriceCondition.salePrice || {};
            salePriceCondition.salePrice.$gte = Number(minPrice);
        }
        if (maxPrice !== undefined) {
            salePriceCondition.salePrice = salePriceCondition.salePrice || {};
            salePriceCondition.salePrice.$lte = Number(maxPrice);
        }

        priceConditions.push(regularPriceCondition, salePriceCondition);
        filter.$or = priceConditions;
    }

    // Rating range filter
    if (minRating !== undefined || maxRating !== undefined) {
        filter['ratings.average'] = {};
        if (minRating !== undefined) filter['ratings.average'].$gte = Number(minRating);
        if (maxRating !== undefined) filter['ratings.average'].$lte = Number(maxRating);
    }

    // Boolean filters
    if (onSale !== undefined) filter.onSale = onSale === 'true';
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';

    // Only show active products by default
    // if (filter.isVisible === undefined) {
    //     filter.isVisible = true;
    // }
    if (isVisible !== undefined) {
        filter.isVisible = isVisible === 'true';
    }

    // Stock filter
    if (inStock !== undefined) {
        filter.stock = inStock === 'true' ? {$gt: 0} : {$eq: 0};
    }

    // Out of stock filter
    if (isLowStock !== undefined) {
        filter.stock = isLowStock === 'true' ? {$lt: 10} : {$gte: 10};
    }

    // Brand filter - handle both string and array formats
    if (brand) {
        filter.brand = {
            $in: Array.isArray(brand) ? brand : brand.split(',')
        };
    }

    // Pet types filter - handle both string and array formats
    if (petTypes) {
        filter.petTypes = {
            $in: Array.isArray(petTypes) ? petTypes : petTypes.split(',')
        };
    }

    // Tags filter - handle both string and array formats
    if (tags) {
        filter.tags = {
            $in: Array.isArray(tags) ? tags : tags.split(',')
        };
    }

    // Build options object for pagination and sorting
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    // Handle sort parameter
    if (sort) {
        const sortParts = sort.split(',');
        const formattedSort = sortParts.map(part => {
            if (part.startsWith('-')) {
                return `${ part.substring(1) }:desc`;
            }
            return `${ part }:asc`;
        }).join(',');

        options.sortBy = formattedSort;
    }

    if (req.user.role === 'user') {
        filter.isVisible = true;
        filter.stock = {$gt: 0};
    }

    console.log('filter', filter);

    const result = await productService.getAllProducts(filter, options);
    res.send(result);
});

const getProduct = catchAsync(async (req, res) => {
    const product = (await productService.getProductById(req.params.productId))

    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }
    res.send(product);
});

const getProductReviews = catchAsync(async (req, res) => {
    const {page = 1, limit = 10} = req.query;
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };
    const reviews = await productService.getProductReviews(req.params.productId, options);
    res.send(reviews);
});

const updateProduct = catchAsync(async (req, res) => {
    const images = req.files.map(file => {
        const filePath = getFilePath(file);
        return filePath
    })

    const oldImages = req.body.existingImages || [];
    const allImages = [...oldImages, ...images];

    const updateData = images.length > 0 ? {...req.body, images: allImages} : req.body;
    const product = await productService.updateProductById(req.params.productId, updateData);
    res.send(product);
});

const updateProductStock = catchAsync(async (req, res) => {
    const {stock} = req.body;
    const product = await productService.updateProductStock(req.params.productId, Number.parseInt(stock, 10));
    res.send(product);
});

const deleteProduct = catchAsync(async (req, res) => {
    await productService.deleteProductById(req.params.productId);
    res.status(status.NO_CONTENT).send();
});

const createProductReview = catchAsync(async (req, res) => {
    const photos = req.files?.map((file) => {
        const filePath = getFilePath(file);
        return filePath;
    });

    req.body.photos = photos || [];
    req.body.customerId = req.user._id;

    const productId = req.params.productId;
    const review = await productService.createReview(productId, req.body);

    res.status(status.CREATED).send(review);
});

const getProductStats = catchAsync(async (req, res) => {
    const stats = await productService.getProductStats();
    res.send(stats);
});

const getProductDistribution = catchAsync(async (req, res) => {
    const distribution = await productService.getProductDistributionByPetTypes();
    res.send(distribution);
});

const getBestSellingProducts = catchAsync(async (req, res) => {
    const {limit = 10} = req.query;
    const products = await productService.getBestSellingProducts(parseInt(limit, 10));
    res.send(products);
});

const getInventoryReport = catchAsync(async (req, res) => {
    const {
        outOfStockLimit = 20,
        oldInventoryLimit = 20,
        oldInventoryDays = 30
    } = req.query;

    const [outOfStock, oldInventory] = await Promise.all([
        productService.getOutOfStockProducts(parseInt(outOfStockLimit, 10)),
        productService.getOldInventoryProducts(
            parseInt(oldInventoryLimit, 10),
            parseInt(oldInventoryDays, 10)
        )
    ]);

    res.send({
        outOfStockProducts: outOfStock,
        oldInventoryProducts: oldInventory
    });
});

const getDashboardAnalytics = catchAsync(async (req, res) => {
    const [productStats, categoryStats, petTypeDistribution, categoryDistribution, bestSelling] = await Promise.all([
        productService.getProductStats(),
        categoryService.getCategoryStats(),
        productService.getProductDistributionByPetTypes(),
        categoryService.getProductDistributionByCategories(),
        productService.getBestSellingProducts(5)
    ]);

    res.send({
        productStats,
        categoryStats,
        distribution: {
            byPetTypes: petTypeDistribution,
            byCategories: categoryDistribution
        },
        bestSellingProducts: bestSelling
    });
});

module.exports = {
    createProduct,
    getProducts,
    getProduct,
    getProductReviews,
    updateProduct,
    updateProductStock,
    deleteProduct,
    createProductReview,
    getProductStats,
    getProductDistribution,
    getBestSellingProducts,
    getInventoryReport,
    getDashboardAnalytics
};
