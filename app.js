const express = require('express');
const cors = require('cors');
const {status} = require('http-status');
const routes = require('./routes');
const {errorConverter, errorHandler} = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const morgan = require('morgan');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

// Parse URL-encoded request body
app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.use('/uploads', express.static(__dirname + '/uploads'));

// Enable CORS
app.use(cors());
// app.options('*', cors());

// API routes
app.use('/api', routes);

// Send 404 for unknown API requests
// app.use((req, res, next) => {
//     next(new ApiError(status.NOT_FOUND, 'Not found'));
// });

// // Convert error to ApiError
// app.use(errorConverter);

// Handle errors
app.use(errorHandler);

module.exports = app;