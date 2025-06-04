const {status} = require('http-status');
const Category = require('../models/category.model');
const ApiError = require('../utils/ApiError');
const Product = require('../models/product.model');

/**
 * Create a category
 * @param {Object} categoryBody
 * @returns {Promise<Category>}
 */
const createCategory = async (categoryBody) => {
    return Category.create(categoryBody);
};

/**
 * Get category by id
 * @param {ObjectId} id
 * @returns {Promise<Category>}
 */
const getCategoryById = async (id) => {
    return Category.findById(id);
};

/**
 * Get all categories
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page
 * @param {number} [options.page] - Current page
 * @returns {Promise<Category[]>}
 */
const getAllCategories = async (filter = {}, options = {}) => {
    const categories = await Category.find(filter)
        .sort(options.sortBy || 'name')
        .limit(options.limit || 20)
        .skip(options.page ? (options.page - 1) * (options.limit || 20) : 0);

    return {
        categories,
        totalPages: Math.ceil(await Category.countDocuments(filter) / (options.limit || 20)),
        currentPage: options.page || 1,
        totalResults: await Category.countDocuments(filter),
    }
};

/**
 * Update category by id
 * @param {ObjectId} categoryId
 * @param {Object} updateBody
 * @returns {Promise<Category>}
 */
const updateCategoryById = async (categoryId, updateBody) => {
    const category = await getCategoryById(categoryId);
    if (!category) {
        throw new ApiError(status.NOT_FOUND, 'Category not found');
    }

    Object.assign(category, updateBody);
    await category.save();
    return category;
};

/**
 * Delete category by id
 * @param {ObjectId} categoryId
 * @returns {Promise<Category>}
 */
const deleteCategoryById = async (categoryId) => {
    const category = await getCategoryById(categoryId);
    if (!category) {
        throw new ApiError(status.NOT_FOUND, 'Category not found');
    }

    const products = await Product.find({
        categoryId: categoryId
    })

    if (products.length > 0) {
        throw new ApiError(status.BAD_REQUEST, 'Category cannot be deleted because it has products');
    }

    await category.deleteOne();
    return category;
};

/**
 * Search categories
 * @param {string} query - Search term
 * @returns {Promise<Category[]>}
 */
const searchCategories = async (query) => {
    const searchOptions = {
        $text: {$search: query}
    };

    return Category.find(searchOptions)
        .sort({score: {$meta: 'textScore'}})
        .limit(20);
};

/**
 * Toggle category active status
 * @param {ObjectId} categoryId
 * @returns {Promise<Category>}
 */
const toggleCategoryStatus = async (categoryId) => {
    const category = await getCategoryById(categoryId);
    if (!category) {
        throw new ApiError(status.NOT_FOUND, 'Category not found');
    }

    category.isVisible = !category.isVisible;
    await category.save();
    return category;
};
/**
 * Get category statistics
 * @returns {Promise<Object>}
 */
const getCategoryStats = async () => {
    const [totalCategories, visibleCategories, categoriesWithProducts] = await Promise.all([
        Category.countDocuments(),
        Category.countDocuments({isVisible: true}),
        Category.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: 'categoryId',
                    as: 'products'
                }
            },
            {
                $match: {
                    'products.0': {$exists: true}
                }
            },
            {
                $count: 'count'
            }
        ])
    ]);

    return {
        totalCategories,
        visibleCategories,
        categoriesWithProducts: categoriesWithProducts[0]?.count || 0,
        emptyCategoriesCount: totalCategories - (categoriesWithProducts[0]?.count || 0)
    };
};

/**
 * Get product distribution by categories
 * @returns {Promise<Array>}
 */
const getProductDistributionByCategories = async () => {
    const distribution = await Category.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'categoryId',
                as: 'products'
            }
        },
        {
            $project: {
                name: 1,
                productCount: {$size: '$products'},
                totalStock: {
                    $sum: '$products.stock'
                },
                averagePrice: {
                    $avg: '$products.price'
                },
                isVisible: 1
            }
        },
        {
            $sort: {productCount: -1}
        }
    ]);

    return distribution.map(cat => ({
        ...cat,
        averagePrice: Math.round((cat.averagePrice || 0) * 100) / 100
    }));
};

module.exports = {
    createCategory,
    getCategoryById,
    getAllCategories,
    updateCategoryById,
    deleteCategoryById,
    searchCategories,
    toggleCategoryStatus,
    getCategoryStats,
    getProductDistributionByCategories
};
