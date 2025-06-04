const express = require('express');
const validate = require('../middlewares/validate.middleware');
const petValidation = require('../validations');
const {petController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');
const {petImageUpload} = require('../configs/multer');

const router = express.Router();

// Add analytics endpoint  
router.get('/analytics',
    auth,
    authorize('admin', 'staff'),
    validate(petValidation.getPetAnalytics.query, 'query'),
    petController.getPetAnalytics
);

router
    .route('/')
    .get(auth, validate(petValidation.getPets.query, 'query'), petController.getPets)
    .post(auth, petImageUpload.single('avatar'), validate(petValidation.createPet.body), petController.createPet);

router
    .route('/:petId')
    .get(auth, validate(petValidation.getPet.params, 'params'), petController.getPet)
    .patch(
        auth,
        petImageUpload.single('avatar'),
        validate(petValidation.updatePet.params, 'params'),
        validate(petValidation.updatePet.body),
        petController.updatePet
    )
    .delete(auth, validate(petValidation.getPet.params, 'params'), petController.deletePet);

// Health records routes
router
    .route('/:petId/health-records')
    .post(
        auth,
        petImageUpload.array('attachments'), // Assuming you want to upload a file for the health record
        validate(petValidation.getPet.params, 'params'),
        validate(petValidation.addHealthRecord.body),
        petController.addHealthRecord
    );

router
    .route('/:petId/health-records/:recordId')
    .patch(
        auth,
        petImageUpload.array('attachments'), // Assuming you want to upload a file for the health record
        validate(petValidation.updateHealthRecord.params, 'params'),
        validate(petValidation.updateHealthRecord.body),
        petController.updateHealthRecord
    )
    .delete(
        auth,
        validate(petValidation.deleteHealthRecord.params, 'params'),
        petController.deleteHealthRecord
    );

// Vaccination routes
router
    .route('/:petId/vaccinations')
    .post(
        auth,
        validate(petValidation.getPet.params, 'params'),
        validate(petValidation.addVaccination.body),
        petController.addVaccination
    );

router
    .route('/:petId/vaccinations/:vaccinationId')
    .patch(
        auth,
        validate(petValidation.updateVaccination.params, 'params'),
        validate(petValidation.updateVaccination.body),
        petController.updateVaccination
    )
    .delete(
        auth,
        validate(petValidation.deleteVaccination.params, 'params'),
        petController.deleteVaccination
    );

// Diet information route
router
    .route('/:petId/diet')
    .patch(
        auth,
        validate(petValidation.getPet.params, 'params'),
        validate(petValidation.updateDietInfo.body),
        petController.updateDietInfo
    );

module.exports = router;
