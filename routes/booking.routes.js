const express = require('express');
const validate = require('../middlewares/validate.middleware');
const bookingValidation = require('../validations');
const {bookingController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');

const router = express.Router();

// Add analytics endpoint
router.get('/analytics',
    auth,
    authorize('admin', 'staff'),
    validate(bookingValidation.getBookingAnalytics.query, 'query'),
    bookingController.getBookingAnalytics
);

// router.put(
//     '/:bookingId/confirm',
//     auth,
//     validate(bookingValidation.getBooking.params, 'params'),
//     bookingController.confirmBooking
// );
router.put(
    '/:bookingId/cancel',
    auth,
    validate(bookingValidation.getBooking.params, 'params'),
    bookingController.cancelBooking
);

router.get(
    '/upcoming',
    auth,
    authorize('admin', 'staff'),
    bookingController.getUpcomingBookings
);
router
    .route('/')
    .get(auth, validate(bookingValidation.getBookings.query, 'query'), bookingController.getBookings)
    .post(auth, validate(bookingValidation.createBooking.body), bookingController.createBooking);

router
    .route('/:bookingId')
    .get(auth, validate(bookingValidation.getBooking.params, 'params'), bookingController.getBooking)
    .patch(
        auth,
        validate(bookingValidation.updateBookingStatus.params, 'params'),
        validate(bookingValidation.updateBookingStatus.body),
        bookingController.updateBooking
    )
    .delete(auth, validate(bookingValidation.getBooking.params, 'params'), bookingController.cancelBooking);

module.exports = router;
