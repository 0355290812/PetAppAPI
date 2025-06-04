const express = require('express');
const authRoute = require('./auth.routes');
const userRoute = require('./user.routes');
const productRoute = require('./product.routes');
const categoryRoute = require('./category.routes');
const cartRoute = require('./cart.routes');
const orderRoute = require('./order.routes');
const reviewRoute = require('./review.routes');
const serviceRoute = require('./service.routes');
const bookingRoute = require('./booking.routes');
const petRoute = require('./pet.routes');
const paymentRoute = require('./payment.routes');
const ragRoute = require('./rag.routes');

const router = express.Router();

const routes = [
    {
        path: '/auth',
        route: authRoute,
    },
    {
        path: '/users',
        route: userRoute,
    },
    {
        path: '/products',
        route: productRoute,
    },
    {
        path: '/categories',
        route: categoryRoute,
    },
    {
        path: '/cart',
        route: cartRoute,
    },
    {
        path: '/orders',
        route: orderRoute,
    },
    {
        path: '/reviews',
        route: reviewRoute,
    },
    {
        path: '/services',
        route: serviceRoute,
    },
    {
        path: '/bookings',
        route: bookingRoute,
    },
    {
        path: '/pets',
        route: petRoute,
    },
    {
        path: '/payments',
        route: paymentRoute,
    },
    {
        path: '/rag',
        route: ragRoute,
    }
];

routes.forEach((route) => {
    router.use(route.path, route.route);
});

module.exports = router;
