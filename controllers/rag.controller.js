const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ragService = require('../services/rag.service');
const ApiError = require('../utils/ApiError');
const path = require('path');
const fs = require('fs');

/**
 * Upload và index một hoặc nhiều tài liệu
 * @route POST /api/rag/documents
 */
const uploadDocuments = catchAsync(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        throw new ApiError(status.BAD_REQUEST, 'No files uploaded');
    }

    const results = [];
    const errors = [];

    // Xử lý từng file một
    for (const file of req.files) {
        try {
            // Kiểm tra định dạng file
            const fileExtension = path.extname(file.path).toLowerCase();
            if (!['.pdf', '.txt'].includes(fileExtension)) {
                errors.push({
                    file: file.originalname,
                    error: "Unsupported file format. Only PDF and TXT files are supported."
                });
                continue;
            }

            // Xử lý upload và indexing
            const result = await ragService.indexDocument(file.path);
            results.push({
                fileName: file.originalname,
                ...result
            });
        } catch (error) {
            console.error(`Error processing file ${ file.originalname }:`, error);
            errors.push({
                file: file.originalname,
                error: error.message
            });
        }
    }

    // Trả về kết quả
    res.status(status.CREATED).send({
        code: status.CREATED,
        message: `${ results.length } documents uploaded and indexed successfully${ errors.length > 0 ? ` (with ${ errors.length } errors)` : '' }`,
        data: {
            successful: results,
            failed: errors
        }
    });
});

const chat = catchAsync(async (req, res) => {
    const {question} = req.body;
    if (!question) {
        throw new ApiError(status.BAD_REQUEST, 'Question is required');
    }

    const answer = await ragService.chat(question, req.user._id);
    res.status(status.OK).send({
        code: status.OK,
        message: 'Answer retrieved successfully',
        data: answer
    });
});

module.exports = {
    uploadDocuments,
    chat
};