const mongoose = require('mongoose');
const config = require('./configs/config');

const app = require('./app');

let server;
mongoose
    .connect(config.mongoose.url, config.mongoose.options)
    .then(() => {
        server = app.listen(config.port, () => {
            console.log(`Server is running on port ${ config.port }`);
        });
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

const exitHandler = () => {
    if (server) {
        server.close(() => {
            console.log('Server closed');
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
};

const unexpectedErrorHandler = (error) => {
    console.error('Unexpected error:', error);
    exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    if (server) {
        server.close();
    }
});
