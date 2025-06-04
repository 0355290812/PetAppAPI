const Joi = require('joi');
const {objectId} = require('./custom.validation');
const {default: status} = require('http-status');

// Auth validations
const register = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        password: Joi.string().required().min(8),
        fullname: Joi.string().required(),
        phone: Joi.string().pattern(/^[0-9]{10}$/),
    }),
};

const login = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        password: Joi.string().required(),
    }),
};

const refreshTokens = {
    body: Joi.object().keys({
        refreshToken: Joi.string().required(),
    }),
};

const forgotPassword = {
    body: Joi.object().keys({
        email: Joi.string().email().required(),
    }),
};

const resetPassword = {
    query: Joi.object().keys({
        token: Joi.string().required(),
    }),
    body: Joi.object().keys({
        password: Joi.string().required().min(8),
    }),
};

const verifyEmail = {
    query: Joi.object().keys({
        token: Joi.string().required(),
    }),
};

// User validations
const createUser = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        password: Joi.string().required().min(8),
        fullname: Joi.string().required(),
        phone: Joi.string().pattern(/^[0-9]{10}$/),
        role: Joi.string().valid('user', 'staff', 'admin').default('user'),
    }),
};

const getUsers = {
    query: Joi.object().keys({
        search: Joi.string(),
        role: Joi.string().valid('user', 'staff', 'admin'),
        banned: Joi.boolean(),
        sort: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getUser = {
    params: Joi.object().keys({
        userId: Joi.custom(objectId),
    }),
};

const updateUser = {
    params: Joi.object().keys({
        userId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            fullname: Joi.string(),
            phone: Joi.string().pattern(/^[0-9]{10}$/),
        })
        .min(1),
};

const banOrUnbanUser = {
    params: Joi.object().keys({
        userId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        isBanned: Joi.boolean().required(),
    }),
};

const changePassword = {
    body: Joi.object().keys({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().required().min(8),
    }),
};

const updateRole = {
    params: Joi.object().keys({
        userId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        role: Joi.string().valid('user', 'staff', 'admin').required(),
    }),
};

// Product validations
const createProduct = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string(),
        price: Joi.number().positive().required(),
        costPrice: Joi.number().positive(),
        salePrice: Joi.number().positive(),
        brand: Joi.string(),
        highlights: Joi.array().items(Joi.string()),
        tags: Joi.array().items(Joi.string()),
        categoryId: Joi.custom(objectId).required(),
        stock: Joi.number().integer().min(0).required(),
        isVisible: Joi.boolean(),
        isFeatured: Joi.boolean(),
        onSale: Joi.boolean(),
        petTypes: Joi.array().items(Joi.string())
    }),
    files: Joi.object().keys({
        images: Joi.array().items(Joi.string().uri()).required(),
    }),
};

const getProducts = {
    query: Joi.object().keys({
        search: Joi.string(),
        categoryId: Joi.custom(objectId),
        petTypes: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ),
        brand: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ),
        minPrice: Joi.number(),
        maxPrice: Joi.number(),
        onSale: Joi.boolean(),
        inStock: Joi.boolean(),
        isFeatured: Joi.boolean(),
        minRating: Joi.number().min(0).max(5),
        maxRating: Joi.number().min(0).max(5),
        tags: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ),
        sort: Joi.string().valid('price', '-price', 'createdAt', '-createdAt', 'name', '-name').default('-createdAt'),
        page: Joi.number().integer().default(1),
        limit: Joi.number().integer().default(12),
        isVisible: Joi.boolean(),
        isLowStock: Joi.boolean(),
    }),
};

const getProduct = {
    params: Joi.object().keys({
        productId: Joi.custom(objectId),
    }),
};

const updateProduct = {
    params: Joi.object().keys({
        productId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            description: Joi.string(),
            highlights: Joi.array().items(Joi.string()),
            price: Joi.number().positive(),
            costPrice: Joi.number().positive(),
            salePrice: Joi.number().positive(),
            brand: Joi.string(),
            tags: Joi.array().items(Joi.string()),
            categoryId: Joi.custom(objectId),
            stock: Joi.number().integer().min(0),
            isVisible: Joi.boolean(),
            isFeatured: Joi.boolean(),
            onSale: Joi.boolean(),
            petTypes: Joi.array().items(Joi.string()),
            existingImages: Joi.array().items(Joi.string()),
        })
};

// Category validations
const createCategory = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string(),
        petTypes: Joi.array().items(Joi.string()),
        isVisible: Joi.boolean(),
    }),
    // file: Joi.object().keys({
    //     image: Joi.string().uri(),
    // }),
};

const getCategories = {
    query: Joi.object().keys({
        name: Joi.string(),
        isVisible: Joi.boolean(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getCategory = {
    params: Joi.object().keys({
        categoryId: Joi.custom(objectId),
    }),
};

const updateCategory = {
    params: Joi.object().keys({
        categoryId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            description: Joi.string(),
            isVisible: Joi.boolean(),
            petTypes: Joi.array().items(Joi.string()),
        })
        .min(1),
};

// Cart validations
const addToCart = {
    body: Joi.object().keys({
        productId: Joi.custom(objectId).required(),
        quantity: Joi.number().integer().min(1).required(),
    }),
};

const updateCartItem = {
    params: Joi.object().keys({
        productId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        quantity: Joi.number().integer().min(1).required(),
    }),
};

// Order validations
const createOrder = {
    body: Joi.object().keys({
        items: Joi.array().items(
            Joi.object().keys({
                productId: Joi.custom(objectId).required(),
                quantity: Joi.number().integer().min(1).required(),
            })
        ).min(1).required(),
        shippingAddress: Joi.object().keys({
            fullName: Joi.string().required(),
            phone: Joi.string().required().pattern(/^[0-9]{10}$/),
            streetAddress: Joi.string().required(),
            ward: Joi.string().required(),
            district: Joi.string().required(),
            city: Joi.string().required(),
            note: Joi.string().allow(''),
        }).required(),
        paymentMethod: Joi.string().valid('credit_card', 'cash'),
        notes: Joi.string().allow(''),
    }),
};

const getUserOrders = {
    query: Joi.object().keys({
        status: Joi.string().valid('checkout', 'pending', 'shipping', 'delivered', 'cancelled'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getOrders = {
    query: Joi.object().keys({
        status: Joi.string().valid('checkout', 'pending', 'shipping', 'delivered', 'cancelled'),
        search: Joi.string(),
        customerId: Joi.custom(objectId),
        paymentStatus: Joi.string().valid('pending', 'paid', 'failed'),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getOrder = {
    params: Joi.object().keys({
        orderId: Joi.custom(objectId),
    }),
};

const updateOrderStatus = {
    params: Joi.object().keys({
        orderId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        status: Joi.string().required().valid('shipping', 'delivered', 'cancelled'),
        cancelReason: Joi.string().optional().allow(''),
    }),
};

const cancelOrder = {
    body: Joi.object().keys({
        cancelReason: Joi.string(),
    }),
};

const processPayment = {
    body: Joi.object().keys({
        orderId: Joi.custom(objectId).required(),
        paymentMethod: Joi.string().required().valid('credit_card', 'cash'),
        paymentDetails: Joi.object().keys({
            status: Joi.string().valid('pending', 'completed', 'failed'),
            transactionId: Joi.string(),
            cardDetails: Joi.object(),
            responseData: Joi.object(),
        }),
    }),
};

const confirmOrderDelivery = {
    params: Joi.object().keys({
        orderId: Joi.custom(objectId),
    }),
};

// Review validations
const createReview = {
    body: Joi.object().keys({
        sourceId: Joi.custom(objectId).required(),
        rating: Joi.number().required().min(1).max(5),
        content: Joi.string(),
    }),
};

const getReviews = {
    query: Joi.object().keys({
        product: Joi.custom(objectId),
        user: Joi.custom(objectId),
        rating: Joi.number().min(1).max(5),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getReview = {
    params: Joi.object().keys({
        reviewId: Joi.custom(objectId),
    }),
};

const updateReview = {
    params: Joi.object().keys({
        reviewId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            rating: Joi.number().min(1).max(5),
            comment: Joi.string(),
        })
        .min(1),
};

// Service validations
const createService = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string().required(),
        highlights: Joi.array().items(Joi.string()),
        price: Joi.number().positive().required(),
        onSale: Joi.boolean(),
        salePrice: Joi.number().positive(),
        duration: Joi.number().integer().positive(),
        isVisible: Joi.boolean(),
        isFeatured: Joi.boolean(),
        petTypes: Joi.array().items(Joi.string()),
        capacity: Joi.number().integer().min(1),
        availability: Joi.object().keys({
            monday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            tuesday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            wednesday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            thursday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            friday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            saturday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            sunday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            })
        }),
        excludedHolidays: Joi.array().items(Joi.date().iso())
    }),
    files: Joi.array().required(),
};

const getServices = {
    query: Joi.object().keys({
        minPrice: Joi.number(),
        maxPrice: Joi.number(),
        minRating: Joi.number().min(0).max(5),
        maxRating: Joi.number().min(0).max(5),
        petTypes: [
            Joi.string(),
            Joi.array().items(Joi.string())
        ],
        onSale: Joi.boolean(),
        isFeatured: Joi.boolean(),
        isVisible: Joi.boolean(),
        name: Joi.string(),
        search: Joi.string(),
        sort: Joi.string().valid('price', '-price', 'createdAt', '-createdAt', 'name', '-name', 'duration', '-duration').default('-createdAt'),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const searchServices = {
    query: Joi.object().keys({
        query: Joi.string().required(),
        petTypes: [
            Joi.string(),
            Joi.array().items(Joi.string())
        ],
        minPrice: Joi.number(),
        maxPrice: Joi.number(),
        minDuration: Joi.number().integer().min(0),
        maxDuration: Joi.number().integer().min(0),
        onSale: Joi.boolean(),
        sort: Joi.string().valid('price', '-price', 'createdAt', '-createdAt', 'name', '-name', 'duration', '-duration', 'score'),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getService = {
    params: Joi.object().keys({
        serviceId: Joi.custom(objectId),
    }),
};

const updateService = {
    params: Joi.object().keys({
        serviceId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            description: Joi.string(),
            highlights: Joi.array().items(Joi.string()),
            price: Joi.number().positive(),
            onSale: Joi.boolean(),
            salePrice: Joi.number().positive(),
            duration: Joi.number().integer().positive(),
            isVisible: Joi.boolean(),
            isFeatured: Joi.boolean(),
            petTypes: Joi.array().items(Joi.string()),
            capacity: Joi.number().integer().min(1),
            existingImages: Joi.array().items(Joi.string()),
            availability: Joi.object().keys({
                monday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                tuesday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                wednesday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                thursday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                friday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                saturday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                }),
                sunday: Joi.object().keys({
                    isOpen: Joi.boolean(),
                    openTime: Joi.string(),
                    closeTime: Joi.string(),
                    slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
                })
            }),
            excludedHolidays: Joi.array().items(Joi.date().iso())
        })
        .min(1),
};

const updateServiceAvailability = {
    params: Joi.object().keys({
        serviceId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        availability: Joi.object().keys({
            monday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            tuesday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            wednesday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            thursday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            friday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            saturday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            }),
            sunday: Joi.object().keys({
                isOpen: Joi.boolean(),
                openTime: Joi.string(),
                closeTime: Joi.string(),
                slotDuration: Joi.number().valid(10, 15, 20, 30, 45, 60, 90, 120)
            })
        }),
        excludedHolidays: Joi.array().items(Joi.date().iso())
    }).min(1),
};

// Booking validations
const createBooking = {
    body: Joi.object().keys({
        petsId: Joi.array().items(Joi.custom(objectId)).required(),
        serviceId: Joi.custom(objectId).required(),
        bookingDate: Joi.date().iso().required(),
        timeSlot: Joi.string().required(),
        notes: Joi.string().allow(''),
        paymentMethod: Joi.string().valid('credit_card', 'cash'),
    }),
};

const getBookings = {
    query: Joi.object().keys({
        search: Joi.string(),
        status: Joi.string().valid('checkout', 'completed', 'booked', 'cancelled'),
        service: Joi.custom(objectId),
        date: Joi.date().iso(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getBooking = {
    params: Joi.object().keys({
        bookingId: Joi.custom(objectId),
    }),
};

const updateBookingStatus = {
    params: Joi.object().keys({
        bookingId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        status: Joi.string().required().valid('completed', 'cancelled'),
        cancellationReason: Joi.string(),
    }),
};

// Pet validations
const createPet = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        species: Joi.string().required(),
        breed: Joi.string(),
        birthDate: Joi.date().iso(),
        weight: Joi.number().positive(),
        gender: Joi.string(),
        color: Joi.string(),
    }),
    // file: Joi.object().keys({
    //     path: Joi.string().uri(),
    // }),
};

const getPets = {
    query: Joi.object().keys({
        search: Joi.string(),
        species: Joi.string(),
        breed: Joi.string(),
        gender: Joi.string(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getPet = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
    }),
};

const updatePet = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            species: Joi.string(),
            breed: Joi.string(),
            birthDate: Joi.date().iso(),
            weight: Joi.number().positive(),
            gender: Joi.string(),
            color: Joi.string(),
        })
        .min(1),
};

// Add health record validation
const addHealthRecord = {
    body: Joi.object().keys({
        title: Joi.string().required(),
        symptoms: Joi.string(),
        diagnosis: Joi.string(),
        treatment: Joi.string(),
        date: Joi.date().iso().required(),
        medications: Joi.array().items(Joi.object().keys({
            name: Joi.string().required(),
            dosage: Joi.string().required(),
            frequency: Joi.string().required(),
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso(),
        })),
        notes: Joi.string(),
        followUp: Joi.object().keys({
            required: Joi.boolean().default(false),
            date: Joi.date().iso(),
        }),
        relatedServiceId: Joi.custom(objectId),
    }),
};

// Update health record validation
const updateHealthRecord = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
        recordId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        title: Joi.string(),
        symptoms: Joi.string(),
        diagnosis: Joi.string(),
        treatment: Joi.string(),
        date: Joi.date().iso(),
        medications: Joi.array().items(Joi.object().keys({
            name: Joi.string(),
            dosage: Joi.string(),
            frequency: Joi.string(),
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso(),
        })),
        notes: Joi.string(),
        followUp: Joi.object().keys({
            required: Joi.boolean().default(false),
            date: Joi.date().iso(),
        }),
        relatedServiceId: Joi.custom(objectId),
    }).min(1),
};

// Delete health record validation
const deleteHealthRecord = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
        recordId: Joi.custom(objectId),
    }),
};

// Add vaccination validation
const addVaccination = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        type: Joi.string().valid('Core', 'Non-Core'),
        dateAdministered: Joi.date().iso().required(),
        expirationDate: Joi.date().iso(),
        provider: Joi.string(),
        notes: Joi.string(),
    }),
};

// Update vaccination validation
const updateVaccination = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
        vaccinationId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        name: Joi.string(),
        type: Joi.string().valid('Core', 'Non-Core'),
        dateAdministered: Joi.date().iso(),
        expirationDate: Joi.date().iso(),
        provider: Joi.string(),
        notes: Joi.string(),
    }).min(1),
};

// Delete vaccination validation
const deleteVaccination = {
    params: Joi.object().keys({
        petId: Joi.custom(objectId),
        vaccinationId: Joi.custom(objectId),
    }),
};

// Update diet info validation
const updateDietInfo = {
    body: Joi.object().keys({
        foodType: Joi.string(),
        schedule: Joi.string(),
        allergies: Joi.array().items(Joi.string()),
        notes: Joi.string(),
    }).min(1),
};

// Payment validations
const createPayment = {
    body: Joi.object().keys({
        order: Joi.custom(objectId).required(),
        amount: Joi.number().positive().required(),
        paymentMethod: Joi.string().required().valid('cash', 'card'),
        transactionId: Joi.string(),
    }),
};

const getPayments = {
    query: Joi.object().keys({
        order: Joi.custom(objectId),
        status: Joi.string().valid('pending', 'completed', 'failed'),
        paymentMethod: Joi.string().valid('cash', 'card'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getPayment = {
    params: Joi.object().keys({
        paymentId: Joi.custom(objectId),
    }),
};

const updatePaymentStatus = {
    params: Joi.object().keys({
        paymentId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        status: Joi.string().required().valid('pending', 'completed', 'failed'),
    }),
};

// Payment intent validations
const createPaymentIntent = {
    body: Joi.object().keys({
        orderId: Joi.custom(objectId).required(),
        paymentMethod: Joi.string().required().valid('cash', 'card'),
    }),
};

const confirmPayment = {
    body: Joi.object().keys({
        clientSecret: Joi.string().required(),
    }),
};

const cancelPayment = {
    body: Joi.object().keys({
        clientSecret: Joi.string().required(),
    }),
};

// Address validations
const addAddress = {
    body: Joi.object().keys({
        fullName: Joi.string().required(),
        phone: Joi.string().required().pattern(/^[0-9]{10}$/),
        streetAddress: Joi.string().required(),
        ward: Joi.string().required(),
        district: Joi.string().required(),
        city: Joi.string().required(),
        isDefault: Joi.boolean()
    }),
};

const getAddress = {
    params: Joi.object().keys({
        addressId: Joi.string().required(),
    }),
};

const updateAddress = {
    params: Joi.object().keys({
        addressId: Joi.custom(objectId),
    }),
    body: Joi.object().keys({
        fullName: Joi.string(),
        phone: Joi.string().pattern(/^[0-9]{10}$/),
        streetAddress: Joi.string(),
        ward: Joi.string(),
        district: Joi.string(),
        city: Joi.string(),
        isDefault: Joi.boolean()
    }).min(1),
};

const deleteAddress = {
    params: Joi.object().keys({
        addressId: Joi.custom(objectId),
    }),
};

// Analytics validations
const getOrderAnalytics = {
    query: Joi.object().keys({
        period: Joi.string().valid('day', 'month', 'year'),
        year: Joi.number().integer().min(2020).max(2030),
        month: Joi.number().integer().min(1).max(12),
        day: Joi.number().integer().min(1).max(31),
    }),
};

const getBookingAnalytics = {
    query: Joi.object().keys({
        period: Joi.string().valid('day', 'month', 'year'),
        year: Joi.number().integer().min(2020).max(2030),
        month: Joi.number().integer().min(1).max(12),
        day: Joi.number().integer().min(1).max(31),
    }),
};

const getUserAnalytics = {
    query: Joi.object().keys({
        period: Joi.string().valid('day', 'month', 'year'),
        year: Joi.number().integer().min(2020).max(2030),
        month: Joi.number().integer().min(1).max(12),
        day: Joi.number().integer().min(1).max(31),
    }),
};

const getPetAnalytics = {
    query: Joi.object().keys({
        period: Joi.string().valid('day', 'month', 'year'),
        year: Joi.number().integer().min(2020).max(2030),
        month: Joi.number().integer().min(1).max(12),
        day: Joi.number().integer().min(1).max(31),
        type: Joi.string(),
    }),
};

// Payment validation object
const paymentValidation = {
    createPaymentIntent,
    confirmPayment,
    cancelPayment,
    getPayment,
};

module.exports = {
    register,
    login,
    refreshTokens,
    forgotPassword,
    resetPassword,
    verifyEmail,
    createUser,
    getUsers,
    getUser,
    updateUser,
    changePassword,
    updateRole,
    banOrUnbanUser,
    // Address validations
    addAddress,
    getAddress,
    updateAddress,
    deleteAddress,
    createProduct,
    getProducts,
    getProduct,
    updateProduct,
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    addToCart,
    updateCartItem,
    createOrder,
    getOrders,
    getUserOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder,
    processPayment,
    confirmOrderDelivery,
    createReview,
    getReviews,
    getReview,
    updateReview,
    createService,
    getServices,
    searchServices,
    getService,
    updateService,
    updateServiceAvailability,
    createBooking,
    getBookings,
    getBooking,
    updateBookingStatus,
    createPet,
    getPets,
    getPet,
    updatePet,
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    addVaccination,
    updateVaccination,
    deleteVaccination,
    updateDietInfo,
    createPayment,
    getPayments,
    getPayment,
    updatePaymentStatus,
    paymentValidation,
    confirmOrderDelivery,
    getOrderAnalytics,
    getBookingAnalytics,
    getUserAnalytics,
    getPetAnalytics,
};
