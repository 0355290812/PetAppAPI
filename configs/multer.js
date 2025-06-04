const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

// Ensure upload directories exist
const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
    return dirPath;
};

// Base upload directory
const uploadDir = path.join(__dirname, '../uploads');
createUploadDir(uploadDir);

// Category images directory
const categoryUploadDir = path.join(uploadDir, 'categories');
createUploadDir(categoryUploadDir);

// Product images directory
const productUploadDir = path.join(uploadDir, 'products');
createUploadDir(productUploadDir);

// User images directory (avatars)
const userUploadDir = path.join(uploadDir, 'users');
createUploadDir(userUploadDir);

// Pet images directory
const petUploadDir = path.join(uploadDir, 'pets');
createUploadDir(petUploadDir);

// Service images directory
const serviceUploadDir = path.join(uploadDir, 'services');
createUploadDir(serviceUploadDir);

const ragUploadDir = path.join(uploadDir, 'rag');
createUploadDir(ragUploadDir);

const reviewUploadDir = path.join(uploadDir, 'reviews');
createUploadDir(reviewUploadDir);

// File filter - only allow images
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
        cb(null, true);
    } else {
        cb(new ApiError(httpStatus.BAD_REQUEST, 'Only image files are allowed'), false);
    }
};

// Create storage configuration for different types of uploads
const createStorage = (directory) => {
    return multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, directory);
        },
        filename: function(req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
};

// Create multer instances for different upload types
const categoryImageUpload = multer({
    storage: createStorage(categoryUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 5 * 1024 * 1024} // 5MB limit
});

const productImageUpload = multer({
    storage: createStorage(productUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 5 * 1024 * 1024}
});

const userImageUpload = multer({
    storage: createStorage(userUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 5 * 1024 * 1024}
});

const petImageUpload = multer({
    storage: createStorage(petUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 5 * 1024 * 1024}
});

const serviceImageUpload = multer({
    storage: createStorage(serviceUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 100 * 1024 * 1024}
});

const ragDocumentUpload = multer({
    storage: createStorage(ragUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 100 * 1024 * 1024}
});

const reviewImageUpload = multer({
    storage: createStorage(reviewUploadDir),
    fileFilter: imageFileFilter,
    limits: {fileSize: 5 * 1024 * 1024}
});

module.exports = {
    categoryImageUpload,
    productImageUpload,
    userImageUpload,
    petImageUpload,
    serviceImageUpload,
    ragDocumentUpload,
    reviewImageUpload,
    getFilePath: (file) => {
        if (!file) return null;
        // Return path starting with /uploads
        return '/uploads' + file.path.split('uploads')[1];
    },
    deleteFile: (filePath) => {
        if (!filePath) return;

        // Remove the leading '/uploads' if it exists
        const relativePath = filePath.startsWith('/uploads') ? filePath.substring(8) : filePath;
        const fullPath = path.join(uploadDir, relativePath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
};
