const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {petService} = require('../services');
const ApiError = require('../utils/ApiError');
const {getFilePath} = require('../configs/multer');

const createPet = catchAsync(async (req, res) => {
    const avatar = req.file ? getFilePath(req.file) : null;

    if (avatar) {
        req.body.avatar = avatar;
    }
    const pet = await petService.createPet({
        ...req.body,
        ownerId: req.user._id
    });
    res.status(status.CREATED).send(pet);
});

const getPets = catchAsync(async (req, res) => {
    // Extract query parameters
    const {search, species, breed, gender, page = 1, limit = 20, sortBy} = req.query;

    // Build filter object
    const filter = {};

    // Add search filter (for name)
    if (search) {
        filter.name = {$regex: search, $options: 'i'};
    }

    // Add species filter
    if (species) {
        filter.species = species;
    }

    // Add breed filter
    if (breed) {
        filter.breed = breed;
    }

    // Add gender filter
    if (gender) {
        filter.gender = gender;
    }

    // Build options object for pagination and sorting
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sortBy
    };

    // Get pets based on user role
    let result;
    if (req.user.role === 'user') {
        result = await petService.getPetsByOwnerId(req.user._id, filter, options);
    } else {
        result = await petService.getAllPets(filter, options);
    }

    res.send(result);
});

const getPet = catchAsync(async (req, res) => {
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    // Verify ownership unless admin
    if (pet.ownerId._id.toString() !== req.user._id.toString() && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    res.send(pet);
});

const updatePet = catchAsync(async (req, res) => {
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }
    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }
    const avatar = req.file ? getFilePath(req.file) : null;

    const updatedPet = await petService.updatePetById(req.params.petId, {...req.body, avatar});
    res.send(updatedPet);
});

const deletePet = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    await petService.deletePetById(req.params.petId);
    res.status(status.NO_CONTENT).send();
});

const addHealthRecord = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const attachments = req.files?.map(file => {
        const filePath = getFilePath(file);
        return filePath
    });
    req.body.attachments = attachments;

    const updatedPet = await petService.addHealthRecord(req.params.petId, req.body);
    res.send(updatedPet);
});

const updateHealthRecord = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const attachments = req.files.map(file => {
        const filePath = getFilePath(file);
        return filePath
    });
    req.body.attachments = attachments;
    const recordIndex = pet.healthRecords.findIndex(record => record._id.toString() === req.params.recordId);
    if (recordIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Health record not found');
    }
    const record = pet.healthRecords[recordIndex];
    if (record.attachments) {
        record.attachments.forEach(attachment => {
            const filePath = getFilePath(attachment);
            return filePath
        });
    }
    req.body.attachments = attachments;
    // Check if the recordId exists in the pet's health records
    if (!record) {
        throw new ApiError(status.NOT_FOUND, 'Health record not found');
    }

    const updatedPet = await petService.updateHealthRecord(req.params.petId, req.params.recordId, req.body);
    res.send(updatedPet);
});

const deleteHealthRecord = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const updatedPet = await petService.deleteHealthRecord(req.params.petId, req.params.recordId);
    res.send(updatedPet);
});

const addVaccination = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const updatedPet = await petService.addVaccination(req.params.petId, req.body);
    res.send(updatedPet);
});

const updateVaccination = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const updatedPet = await petService.updateVaccination(req.params.petId, req.params.vaccinationId, req.body);
    res.send(updatedPet);
});

const deleteVaccination = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const updatedPet = await petService.deleteVaccination(req.params.petId, req.params.vaccinationId);
    res.send(updatedPet);
});

const updateDietInfo = catchAsync(async (req, res) => {
    // Verify ownership unless admin
    const pet = await petService.getPetById(req.params.petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (pet.ownerId.toString() !== req.user._id && req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Access denied');
    }

    const updatedPet = await petService.updateDietInfo(req.params.petId, req.body);
    res.send(updatedPet);
});

const getPetAnalytics = catchAsync(async (req, res) => {
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const {period, year, month, day, type} = req.query;

    // If type is 'statistics', return comprehensive statistics
    if (type === 'statistics') {
        const statistics = await petService.getPetStatistics();
        return res.send({
            success: true,
            data: statistics
        });
    }

    // Otherwise return time-based analytics
    const analytics = await petService.getPetAnalytics(period, year, month, day);

    res.send({
        success: true,
        data: analytics
    });
});

const getPetStatistics = catchAsync(async (req, res) => {
    if (req.user.role === 'user') {
        throw new ApiError(status.FORBIDDEN, 'Admin access required');
    }

    const statistics = await petService.getPetStatistics();

    res.send({
        success: true,
        data: statistics
    });
});

module.exports = {
    createPet,
    getPets,
    getPet,
    updatePet,
    deletePet,
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    addVaccination,
    updateVaccination,
    deleteVaccination,
    updateDietInfo,
    getPetAnalytics,
    getPetStatistics
};
