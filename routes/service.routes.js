const express = require('express');
const validate = require('../middlewares/validate.middleware');
const serviceValidation = require('../validations');
const {serviceController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');
const {serviceImageUpload, reviewImageUpload} = require('../configs/multer');

const router = express.Router();

// Add statistics routes before existing routes
router.get('/statistics',
    auth,
    authorize('admin', 'staff'),
    serviceController.getServiceStatistics
);

router.get('/statistics/repeat-usage',
    auth,
    authorize('admin', 'staff'),
    serviceController.getRepeatServiceUsage
);

router.get('/statistics/peak-hours',
    auth,
    authorize('admin', 'staff'),
    serviceController.getPeakHoursStatistics
);

router
    .route('/')
    .get(auth, validate(serviceValidation.getServices.query, 'query'), serviceController.getServices)
    .post(
        auth,
        authorize('admin'),
        serviceImageUpload.array('images'),
        validate(serviceValidation.createService.body),
        serviceController.createService
    );

// router
//     .route('/search')
//     .get(validate(serviceValidation.searchServices, 'query'), serviceController.searchServices);

// router
//     .route('/featured')
//     .get(serviceController.getFeaturedServices);

// router
//     .route('/sale')
//     .get(serviceController.getSaleServices);

// router
//     .route('/pet-type/:petType')
//     .get(serviceController.getServicesByPetType);

router
    .route('/:serviceId')
    .get(auth, validate(serviceValidation.getService.params, 'params'), serviceController.getService)
    .patch(
        auth,
        authorize('admin'),
        serviceImageUpload.array('images'),
        validate(serviceValidation.updateService.params, 'params'),
        validate(serviceValidation.updateService.body, 'body'),
        serviceController.updateService
    )
    .delete(
        auth,
        authorize('admin'),
        validate(serviceValidation.getService.params, 'params'),
        serviceController.deleteService
    );

router
    .route('/:serviceId/featured')
    .patch(
        auth,
        authorize('admin'),
        validate(serviceValidation.getService.params, 'params'),
        serviceController.toggleFeatured
    );

router
    .route('/:serviceId/visible')
    .patch(
        auth,
        authorize('admin'),
        validate(serviceValidation.getService.params, 'params'),
        serviceController.toggleServiceVisible
    );

router
    .route('/:serviceId/availability')
    .patch(
        auth,
        authorize('admin'),
        validate(serviceValidation.updateServiceAvailability.body, 'body'),
        validate(serviceValidation.updateServiceAvailability.params, 'params'),
        serviceController.updateServiceAvailability
    );

// Remove this route since we're handling images in the main update function
// router
//     .route('/:serviceId/images')
//     .patch(
//         auth,
//         authorize('admin'),
//         serviceImageUpload.array('images'),
//         validate(serviceValidation.getService.params, 'params'),
//         serviceController.updateServiceImages
//     );

router
    .route('/:serviceId/timeslots')
    .get(
        auth,
        validate(serviceValidation.getService.params, 'params'),
        serviceController.getServiceTimeslots
    );

router
    .route('/:serviceId/reviews')
    .get(
        auth,
        validate(serviceValidation.getService.params, 'params'),
        serviceController.getReviewsByServiceId
    )
    .post(
        auth,
        reviewImageUpload.array('photos'),
        validate(serviceValidation.createReview.body),
        validate(serviceValidation.getService.params, 'params'),
        serviceController.createServiceReview
    );

module.exports = router;
