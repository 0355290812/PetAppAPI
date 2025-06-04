const {getFilePath} = require('../configs/multer');

/**
 * Process uploaded files and set their paths in the request body
 * @param {string} fieldName - The name of the field in request body to set
 */
const processUploadedFile = (fieldName) => (req, res, next) => {
    if (req.file) {
        // Convert the uploaded file to a path and set it in the request body
        req.body[fieldName] = getFilePath(req.file);
    }
    next();
};

/**
 * Process multiple uploaded files and set their paths in the request body
 * @param {string} fieldName - The name of the field in request body to set
 */
const processUploadedFiles = (fieldName) => (req, res, next) => {
    if (req.files) {
        // Convert the uploaded files to paths and set them in the request body
        req.body[fieldName] = req.files.map((file) => getFilePath(file));
    }
    next();
}

module.exports = {
    processUploadedFile,
    processUploadedFiles,
};
