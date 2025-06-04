const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {categoryService} = require('../services');
const {getFilePath} = require('../configs/multer');
const ApiError = require('../utils/ApiError');

const createCategory = catchAsync(async (req, res) => {
    const image = req.file ? getFilePath(req.file) : null;
    if (!image) {
        throw new ApiError(status.BAD_REQUEST, 'Image is required');
    }
    const category = await categoryService.createCategory({...req.body, image});
    res.status(status.CREATED).send(category);
});

const getCategories = catchAsync(async (req, res) => {
    const filter = {
        ...(req.query.name && {name: {$regex: req.query.name, $options: 'i'}}),
        ...(req.user.role !== "user" ? (req.query.isVisible && {isVisible: req.query.isVisible}) : {isVisible: true}),
    };
    const options = {
        sortBy: req.query.sortBy,
        limit: req.query.limit,
        page: req.query.page,
    };
    const result = await categoryService.getAllCategories(filter, options);
    res.send(result);
});

const getCategory = catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.categoryId);
    if (!category) {
        throw new ApiError(status.NOT_FOUND, 'Category not found');
    }
    res.send(category);
});

const updateCategory = catchAsync(async (req, res) => {
    const category = await categoryService.updateCategoryById(req.params.categoryId, req.body);
    res.send(category);
});

const deleteCategory = catchAsync(async (req, res) => {
    await categoryService.deleteCategoryById(req.params.categoryId);
    res.status(status.NO_CONTENT).send();
});

module.exports = {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
};
