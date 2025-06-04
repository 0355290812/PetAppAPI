const express = require('express');
const validate = require('../middlewares/validate.middleware');
const categoryValidation = require('../validations');
const {categoryController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');
const {categoryImageUpload} = require('../configs/multer');


const router = express.Router();

router
    .route('/')
    .get(auth, validate(categoryValidation.getCategories.query, 'query'), categoryController.getCategories)
    .post(
        auth,
        authorize('admin'),
        categoryImageUpload.single('image'),
        validate(categoryValidation.createCategory.body),
        categoryController.createCategory
    );

router
    .route('/:categoryId')
    .get(auth, authorize('admin', 'staff'), validate(categoryValidation.getCategory.params, 'params'), categoryController.getCategory)
    .patch(
        auth,
        authorize('admin'),
        categoryImageUpload.single('image'),
        validate(categoryValidation.updateCategory.params, 'params'),
        validate(categoryValidation.updateCategory.body),
        categoryController.updateCategory
    )
    .delete(
        auth,
        authorize('admin'),
        validate(categoryValidation.getCategory.params, 'params'),
        categoryController.deleteCategory
    );

module.exports = router;
