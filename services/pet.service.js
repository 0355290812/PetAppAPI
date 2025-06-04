const {status} = require('http-status');
const Pet = require('../models/pet.model');
const ApiError = require('../utils/ApiError');

/**
 * Create a pet
 * @param {Object} petBody
 * @returns {Promise<Pet>}
 */
const createPet = async (petBody) => {
    return Pet.create(petBody);
};

/**
 * Get pet by id
 * @param {ObjectId} id
 * @returns {Promise<Pet>}
 */
const getPetById = async (id) => {
    return Pet.findById(id)
        .populate('ownerId', 'fullname email phone avatar')
        .populate({
            path: 'healthRecords',
            populate: {
                path: 'relatedServiceId',
            }
        });
};

/**
 * Get pets by owner id with filters
 * @param {ObjectId} ownerId
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing pets and pagination info
 */
const getPetsByOwnerId = async (ownerId, filter = {}, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Add owner filter to the provided filters
    const combinedFilter = {...filter, ownerId};

    // Create sort object from sortBy string
    let sort = {createdAt: -1}; // Default sort
    if (options.sortBy) {
        if (options.sortBy.startsWith('-')) {
            sort = {[options.sortBy.substring(1)]: -1};
        } else {
            sort = {[options.sortBy]: 1};
        }
    }

    const [pets, totalResults] = await Promise.all([
        Pet.find(combinedFilter)
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Pet.countDocuments(combinedFilter)
    ]);

    return {
        results: pets,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Get all pets with filters
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object containing pets and pagination info
 */
const getAllPets = async (filter = {}, options = {}) => {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Create sort object from sortBy string
    let sort = {createdAt: -1}; // Default sort
    if (options.sortBy) {
        if (options.sortBy.startsWith('-')) {
            sort = {[options.sortBy.substring(1)]: -1};
        } else {
            sort = {[options.sortBy]: 1};
        }
    }

    const [pets, totalResults] = await Promise.all([
        Pet.find(filter)
            .populate('ownerId', 'fullname email phone avatar')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Pet.countDocuments(filter)
    ]);

    return {
        results: pets,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults
    };
};

/**
 * Update pet by id
 * @param {ObjectId} petId
 * @param {Object} updateBody
 * @returns {Promise<Pet>}
 */
const updatePetById = async (petId, updateBody) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    Object.assign(pet, updateBody);
    await pet.save();
    return pet;
};

/**
 * Delete pet by id
 * @param {ObjectId} petId
 * @returns {Promise<Pet>}
 */
const deletePetById = async (petId) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    await pet.deleteOne();
    return pet;
};

/**
 * Add health record to pet
 * @param {ObjectId} petId
 * @param {Object} healthRecordData
 * @returns {Promise<Pet>}
 */
const addHealthRecord = async (petId, healthRecordData) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    pet.healthRecords.push(healthRecordData);
    await pet.save();
    return pet;
};

/**
 * Update health record
 * @param {ObjectId} petId
 * @param {ObjectId} recordId
 * @param {Object} updateBody
 * @returns {Promise<Pet>}
 */
const updateHealthRecord = async (petId, recordId, updateBody) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    const recordIndex = pet.healthRecords.findIndex(record => record._id.toString() === recordId);
    if (recordIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Health record not found');
    }

    Object.assign(pet.healthRecords[recordIndex], updateBody);
    await pet.save();
    return pet;
};

/**
 * Delete health record
 * @param {ObjectId} petId
 * @param {ObjectId} recordId
 * @returns {Promise<Pet>}
 */
const deleteHealthRecord = async (petId, recordId) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    const recordIndex = pet.healthRecords.findIndex(record => record._id.toString() === recordId);
    if (recordIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Health record not found');
    }

    pet.healthRecords.splice(recordIndex, 1);
    await pet.save();
    return pet;
};

/**
 * Add vaccination to pet
 * @param {ObjectId} petId
 * @param {Object} vaccinationData
 * @returns {Promise<Pet>}
 */
const addVaccination = async (petId, vaccinationData) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    pet.vaccinations.push(vaccinationData);
    await pet.save();
    return pet;
};

/**
 * Update vaccination
 * @param {ObjectId} petId
 * @param {ObjectId} vaccinationId
 * @param {Object} updateBody
 * @returns {Promise<Pet>}
 */
const updateVaccination = async (petId, vaccinationId, updateBody) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    const vaccinationIndex = pet.vaccinations.findIndex(vaccination => vaccination._id.toString() === vaccinationId);
    if (vaccinationIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Vaccination not found');
    }

    Object.assign(pet.vaccinations[vaccinationIndex], updateBody);
    await pet.save();
    return pet;
};

/**
 * Delete vaccination
 * @param {ObjectId} petId
 * @param {ObjectId} vaccinationId
 * @returns {Promise<Pet>}
 */
const deleteVaccination = async (petId, vaccinationId) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    const vaccinationIndex = pet.vaccinations.findIndex(vaccination => vaccination._id.toString() === vaccinationId);
    if (vaccinationIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Vaccination not found');
    }

    pet.vaccinations.splice(vaccinationIndex, 1);
    await pet.save();
    return pet;
};

/**
 * Update pet diet info
 * @param {ObjectId} petId
 * @param {Object} dietInfoData
 * @returns {Promise<Pet>}
 */
const updateDietInfo = async (petId, dietInfoData) => {
    const pet = await getPetById(petId);
    if (!pet) {
        throw new ApiError(status.NOT_FOUND, 'Pet not found');
    }

    if (!pet.dietInfo) {
        pet.dietInfo = {};
    }

    Object.assign(pet.dietInfo, dietInfoData);
    await pet.save();
    return pet;
};

/**
 * Get date ranges for analytics
 * @param {string} period - 'day', 'month', or 'year'
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {Object} - startDate, endDate, prevStartDate, prevEndDate
 */
const getDateRanges = (period, year, month, day) => {
    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;

    if (period === 'day' && year && month && day) {
        startDate = new Date(year, month - 1, day);
        endDate = new Date(year, month - 1, day, 23, 59, 59);
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 1);
        prevEndDate = new Date(prevStartDate);
        prevEndDate.setHours(23, 59, 59);
    } else if (period === 'month' && year && month) {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
        prevStartDate = new Date(year, month - 2, 1);
        prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);
    } else if (period === 'year' && year) {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
        prevStartDate = new Date(year - 1, 0, 1);
        prevEndDate = new Date(year - 1, 11, 31, 23, 59, 59);
    } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return {startDate, endDate, prevStartDate, prevEndDate};
};

/**
 * Get pet analytics
 * @param {string} period - 'day', 'month', or 'year'
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {Object} - Analytics data
 */
const getPetAnalytics = async (period, year, month, day) => {
    const {startDate, endDate, prevStartDate, prevEndDate} = getDateRanges(period, year, month, day);

    // Total pets
    const totalPets = await Pet.countDocuments();

    // New pets in current period
    const newPets = await Pet.countDocuments({
        createdAt: {$gte: startDate, $lte: endDate}
    });

    // New pets in previous period
    const prevNewPets = await Pet.countDocuments({
        createdAt: {$gte: prevStartDate, $lte: prevEndDate}
    });

    return {
        totalPets,
        current: {
            newPets
        },
        previous: {
            newPets: prevNewPets
        },
        growth: {
            newPetsGrowth: prevNewPets > 0
                ? ((newPets - prevNewPets) / prevNewPets * 100).toFixed(2)
                : newPets > 0 ? 100 : 0
        }
    };
};

/**
 * Get comprehensive pet statistics
 * @returns {Object} - Comprehensive statistics data
 */
const getPetStatistics = async () => {
    // Total pets
    const totalPets = await Pet.countDocuments();

    // Distribution by species
    const speciesDistribution = await Pet.aggregate([
        {
            $group: {
                _id: '$species',
                count: {$sum: 1}
            }
        },
        {
            $project: {
                species: '$_id',
                count: 1,
                percentage: {
                    $multiply: [
                        {$divide: ['$count', totalPets]},
                        100
                    ]
                },
                _id: 0
            }
        },
        {$sort: {count: -1}}
    ]);

    // Distribution by breed (top 10)
    const breedDistribution = await Pet.aggregate([
        {
            $match: {
                breed: {$exists: true, $ne: null, $ne: ''}
            }
        },
        {
            $group: {
                _id: '$breed',
                count: {$sum: 1}
            }
        },
        {
            $project: {
                breed: '$_id',
                count: 1,
                percentage: {
                    $multiply: [
                        {$divide: ['$count', totalPets]},
                        100
                    ]
                },
                _id: 0
            }
        },
        {$sort: {count: -1}},
        {$limit: 10}
    ]);

    // Distribution by age groups
    const currentDate = new Date();
    const ageDistribution = await Pet.aggregate([
        {
            $addFields: {
                ageInMonths: {
                    $divide: [
                        {$subtract: [currentDate, '$birthDate']},
                        1000 * 60 * 60 * 24 * 30.44 // milliseconds to months
                    ]
                }
            }
        },
        {
            $addFields: {
                ageGroup: {
                    $switch: {
                        branches: [
                            {
                                case: {$lt: ['$ageInMonths', 6]},
                                then: 'Puppy/Kitten (0-6 months)'
                            },
                            {
                                case: {$lt: ['$ageInMonths', 12]},
                                then: 'Young (6-12 months)'
                            },
                            {
                                case: {$lt: ['$ageInMonths', 36]},
                                then: 'Adult (1-3 years)'
                            },
                            {
                                case: {$lt: ['$ageInMonths', 84]},
                                then: 'Mature (3-7 years)'
                            }
                        ],
                        default: 'Senior (7+ years)'
                    }
                }
            }
        },
        {
            $group: {
                _id: '$ageGroup',
                count: {$sum: 1}
            }
        },
        {
            $project: {
                ageGroup: '$_id',
                count: 1,
                percentage: {
                    $multiply: [
                        {$divide: ['$count', totalPets]},
                        100
                    ]
                },
                _id: 0
            }
        },
        {$sort: {count: -1}}
    ]);

    // Gender distribution
    const genderDistribution = await Pet.aggregate([
        {
            $group: {
                _id: '$gender',
                count: {$sum: 1}
            }
        },
        {
            $project: {
                gender: '$_id',
                count: 1,
                percentage: {
                    $multiply: [
                        {$divide: ['$count', totalPets]},
                        100
                    ]
                },
                _id: 0
            }
        },
        {$sort: {count: -1}}
    ]);

    return {
        totalPets,
        distributions: {
            species: speciesDistribution,
            breeds: breedDistribution,
            ageGroups: ageDistribution,
            gender: genderDistribution
        }
    };
};

module.exports = {
    createPet,
    getPetById,
    getPetsByOwnerId,
    getAllPets,
    updatePetById,
    deletePetById,
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
