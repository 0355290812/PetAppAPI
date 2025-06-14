const {status} = require('http-status');
const path = require('path');
const fs = require('fs');
const {ChatGroq} = require('@langchain/groq');
const {PDFLoader} = require('@langchain/community/document_loaders/fs/pdf');
const {TextLoader} = require('langchain/document_loaders/fs/text');
const {RecursiveCharacterTextSplitter} = require("@langchain/textsplitters");
const {PineconeEmbeddings} = require('@langchain/pinecone');
const {Pinecone: PineconeClient} = require('@pinecone-database/pinecone');
const {PineconeStore} = require('@langchain/pinecone');
const {StateGraph, END, START, MemorySaver, Annotation} = require('@langchain/langgraph');
const {TavilySearch} = require('@langchain/tavily');
const {ToolNode} = require('@langchain/langgraph/prebuilt');
const {DynamicStructuredTool} = require('@langchain/core/tools');
const Document = require('../models/document.model');
const {getFilePath, deleteFile} = require('../configs/multer')
const {z} = require('zod');
const ApiError = require('../utils/ApiError');

// Import database models (adjust paths as needed)
const User = require('../models/user.model');
const Pet = require('../models/pet.model');
const Product = require('../models/product.model');
const Service = require('../models/service.model');
const Appointment = require('../models/booking.model');
const Order = require('../models/order.model');

const memory = new MemorySaver();

// Define state using Annotation
const GraphState = Annotation.Root({
    messages: Annotation({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    context: Annotation({
        reducer: (x, y) => y,
        default: () => ""
    }),
    answer: Annotation({
        reducer: (x, y) => y,
        default: () => ""
    }),
    userId: Annotation({
        reducer: (x, y) => y,
        default: () => null
    })
});

let executor = null;
let persistentExecutor = null;
let vectorStore = null;
let embeddings = null;
let llm = null;
let pineconeIndex = null;

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});

/**
 * Khởi tạo dịch vụ RAG
 */
const initRAGService = async () => {
    if (llm && vectorStore && embeddings) {
        return;
    }

    llm = new ChatGroq({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.7,
    });

    embeddings = new PineconeEmbeddings({
        model: process.env.EMBEDDING_MODEL || "multilingual-e5-large"
    });

    const pinecone = new PineconeClient();
    pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

    vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
    });
};

/**
 * Load tài liệu dựa vào định dạng file
 */
const loadDocumentByFormat = async (filePath) => {
    const fileExtension = path.extname(filePath).toLowerCase();

    switch (fileExtension) {
        case '.pdf':
            const pdfLoader = new PDFLoader(filePath);
            return pdfLoader.load();
        case '.txt':
            const textLoader = new TextLoader(filePath);
            return textLoader.load();
        default:
            throw new ApiError(status.BAD_REQUEST, "Unsupported file format. Only PDF and TXT files are supported.");
    }
};

/**
 * Index tài liệu vào vector store
 */
const indexDocument = async (file) => {
    await initRAGService();

    const fileExtension = path.extname(file.path).toLowerCase();
    if (!['.pdf', '.txt'].includes(fileExtension)) {
        throw new ApiError(status.BAD_REQUEST, "Unsupported file format. Only PDF and TXT files are supported.");
    }

    try {
        const fileName = file.originalname;
        const docs = await loadDocumentByFormat(file.path);

        docs.forEach(doc => {
            doc.metadata.fileName = fileName;
        });

        const splitDocs = await textSplitter.splitDocuments(docs);
        const batchSize = 96;
        const batches = [];

        for (let i = 0; i < splitDocs.length; i += batchSize) {
            const batch = splitDocs.slice(i, i + batchSize);
            batches.push(batch);
        }
        const docIds = [];

        await Promise.all(
            batches.map(async (batch, index) => {
                const doc = await vectorStore.addDocuments(batch);
                docIds.push(...doc);
                return doc;
            })
        );

        await Document.create({
            fileUrl: getFilePath(file),
            fileName: fileName,
            docIds: docIds,
            fileType: fileExtension === '.pdf' ? 'pdf' : 'txt'
        });

        return {
            success: true,
            fileName: fileName,
            documentCount: splitDocs.length,
            message: `Successfully indexed ${ splitDocs.length } document chunks from ${ fileName }`
        };
    } catch (error) {
        console.error("Error indexing document:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to index document: ${ error.message }`);
    }
};

/**
 * Truy vấn thông tin đơn lẻ
 */
const query = async (userQuery, systemPrompt = "You are a helpful pet care assistant. Provide accurate and helpful information about pet health, nutrition, training, and general care.") => {
    await initRAGService();

    const embedQuery = await embeddings.embedQuery(userQuery);
    const searchResults = await vectorStore.similaritySearchVectorWithScore(embedQuery, 4);

    const contextText = searchResults
        .map(([doc, score]) => `${ doc.pageContent } (Relevance: ${ score.toFixed(2) })`)
        .join("\n\n");

    const enhancedSystemPrompt = `${ systemPrompt }\n\nContext from pet care knowledge base:\n${ contextText }\n\nIf information isn't available in the context, clarify this and provide general pet care advice while encouraging consultation with a veterinarian for health concerns.`;

    const response = await llm.invoke([
        ["system", enhancedSystemPrompt],
        ["human", userQuery]
    ]);

    return {
        answer: response.content,
        sources: searchResults.map(([doc, score]) => ({
            content: doc.pageContent.substring(0, 200) + "...",
            metadata: doc.metadata,
            score: score
        }))
    };
};

/**
 * Quyết định xem có cần lấy thêm thông tin hay không
 */
const shouldRetrieve = async (state) => {
    console.log("---DECIDE TO RETRIEVE---");
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    const systemPrompt = `
    You are a pet care assistant analyzer. Determine if this message requires retrieving information from the knowledge base.
    
    Current message: "${ lastMessage.content }"

    Messages that should trigger retrieval:
    - Questions about pet health, nutrition, training, or care
    - Queries about pet breeds or specific pet behaviors
    - Questions about pet medical conditions or treatments
    - Requests for pet product recommendations

    Messages that do NOT need retrieval:
    - Simple greetings or acknowledgments
    - User expressions of gratitude
    - Questions unrelated to pet care
    
    Respond with ONLY "retrieve" or "direct_response".
    `;

    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", "Should I retrieve information for this message?"]
    ]);

    const decision = response.content.toLowerCase().trim();
    return decision.includes("retrieve") ? "retrieve" : "direct_response";
};

/**
 * Trả lời trực tiếp không cần lấy thông tin từ knowledge base
 */
const directResponse = async (state) => {
    console.log("---DIRECT RESPONSE---");
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    const response = await llm.invoke([
        ["system", "You are a friendly pet care assistant. Respond helpfully to greetings, thanks, or simple questions. Keep responses concise and mention you're here to help with pet care questions."],
        ["human", lastMessage.content]
    ]);

    return {
        answer: response.content
    };
};

/**
 * Lấy thông tin từ vector store
 */
const retrieve = async (state) => {
    console.log("---RETRIEVE PET INFO---");
    const messages = state.messages;
    const query = messages[messages.length - 1].content;

    const embedQuery = await embeddings.embedQuery(query);
    const searchResults = await vectorStore.similaritySearchVectorWithScore(embedQuery, 4);

    const contextText = searchResults
        .map(([doc, score]) => {
            const metadata = doc.metadata || {};
            const source = metadata.fileName || metadata.sourceFile || "unknown source";
            return `${ doc.pageContent }\n(Source: ${ source }, Relevance: ${ score.toFixed(2) })`;
        })
        .join("\n\n");

    return {
        context: contextText
    };
};

/**
 * Tạo câu trả lời dựa trên thông tin đã lấy được
 */
const generate = async (state) => {
    console.log("---GENERATE---");
    const messages = state.messages;
    const context = state.context;
    const query = messages[messages.length - 1].content;

    const systemPrompt = `You are a helpful pet care assistant. Provide accurate information about pet health, nutrition, behavior, training, and general care based on the provided context.

Context information:
${ context }`;

    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", query],
    ]);

    return {
        answer: response.content
    };
};

/**
 * Agent node - decides whether to use tools, retrieve info, or respond directly
 */
const agent = async (state) => {
    console.log("---PET CARE AGENT---");
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // Check if this is a general pet care question that needs RAG retrieval
    const needsRAG = await shouldRetrieveKnowledge(lastMessage.content);

    let systemPrompt = `You are a helpful pet care assistant with access to tools for:
        - Getting user's pets information
        - Searching products and services  
        - Booking appointments
        - Adding items to cart
        - Getting personalized recommendations

        Current user ID: ${ state.userId || 'unknown' }
        
        When users ask about their pets, appointments, products, or services, use the appropriate tools.
        For general pet care questions, provide helpful advice from your knowledge.`;

    // If needs RAG, add context from vector store
    if (needsRAG) {
        const context = await retrieveContext(lastMessage.content);
        if (context) {
            systemPrompt += `\n\nAdditional context from knowledge base:\n${ context }`;
        }
    }

    const response = await llm.invoke([
        ["system", systemPrompt],
        ...messages
    ]);

    return {
        messages: [response]
    };
};

/**
 * Check if query needs knowledge base retrieval
 */
const shouldRetrieveKnowledge = async (query) => {
    const ragKeywords = [
        'health', 'nutrition', 'diet', 'behavior', 'training', 'medical',
        'treatment', 'disease', 'symptom', 'care', 'breed', 'vaccination',
        'exercise', 'grooming', 'feeding', 'veterinary'
    ];

    const queryLower = query.toLowerCase();
    return ragKeywords.some(keyword => queryLower.includes(keyword));
};

/**
 * Retrieve context from vector store
 */
const retrieveContext = async (query) => {
    try {
        if (!embeddings || !vectorStore) {
            await initRAGService();
        }

        const embedQuery = await embeddings.embedQuery(query);
        const searchResults = await vectorStore.similaritySearchVectorWithScore(embedQuery, 3);

        if (searchResults.length === 0) {
            return null;
        }

        return searchResults
            .map(([doc, score]) => {
                const metadata = doc.metadata || {};
                const source = metadata.fileName || metadata.sourceFile || "knowledge base";
                return `${ doc.pageContent }\n(Source: ${ source }, Relevance: ${ score.toFixed(2) })`;
            })
            .join("\n\n");
    } catch (error) {
        console.error("Error retrieving context:", error);
        return null;
    }
};

/**
 * Route after agent - check if tools were called
 */
const routeAfterAgent = (state) => {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
    } else {
        return "end";
    }
};

// Database interaction tools
const getUserPetsTool = new DynamicStructuredTool({
    name: "get_user_pets",
    description: "Get all pets belonging to a specific user",
    schema: z.object({
        userId: z.string().describe("The user ID to get pets for")
    }),
    func: async ({userId}) => {
        try {
            const petService = require('./pet.service');
            const result = await petService.getPetsByOwnerId(userId, {}, {limit: 50});

            return JSON.stringify({
                success: true,
                pets: result.results.map(pet => ({
                    id: pet._id,
                    name: pet.name,
                    species: pet.species,
                    breed: pet.breed,
                    age: pet.age ? Math.floor((new Date() - new Date(pet.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown',
                    weight: pet.weight,
                    gender: pet.gender,
                    healthConditions: pet.healthRecords?.map(record => record.diagnosis).filter(Boolean) || []
                })),
                total: result.totalResults
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error fetching pets: ${ error.message }`
            });
        }
    }
});

const searchProductsTool = new DynamicStructuredTool({
    name: "search_products",
    description: "Search for pet products by name, category, or species",
    schema: z.object({
        query: z.string().describe("Search query for products"),
        species: z.string().optional().describe("Filter by pet species (dog, cat, etc.)"),
        category: z.string().optional().describe("Filter by product category"),
        limit: z.number().default(10).describe("Maximum number of results")
    }),
    func: async ({query, species, category, limit}) => {
        try {
            const productService = require('./product.service');

            const filter = {};
            const options = {
                limit: limit,
                page: 1
            };

            // Build search criteria
            if (query) {
                filter.$or = [
                    {name: {$regex: query, $options: 'i'}},
                    {description: {$regex: query, $options: 'i'}},
                    {brand: {$regex: query, $options: 'i'}},
                    {tags: {$in: [new RegExp(query, 'i')]}}
                ];
            }

            if (species) {
                filter.petTypes = {$in: [species]};
            }

            if (category) {
                // Get category by name first
                const categoryService = require('./category.service');
                const categories = await categoryService.getAllCategories({name: {$regex: category, $options: 'i'}});
                if (categories.categories && categories.categories.length > 0) {
                    filter.categoryId = categories.categories[0]._id;
                }
            }

            filter.isVisible = true; // Only show visible products

            const result = await productService.getAllProducts(filter, options);

            return JSON.stringify({
                success: true,
                products: result.results.map(product => ({
                    id: product._id,
                    name: product.name,
                    description: product.description,
                    price: product.onSale && product.salePrice ? product.salePrice : product.price,
                    originalPrice: product.price,
                    onSale: product.onSale,
                    brand: product.brand,
                    category: product.categoryId?.name,
                    rating: product.rating || 0,
                    inStock: product.stock > 0,
                    stock: product.stock,
                    petTypes: product.petTypes,
                    image: product.images?.[0]
                })),
                total: result.totalResults
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error searching products: ${ error.message }`
            });
        }
    }
});

const searchServicesTool = new DynamicStructuredTool({
    name: "search_services",
    description: "Search for pet services like grooming, veterinary, training",
    schema: z.object({
        query: z.string().describe("Search query for services, is Vietnamese"),
        serviceType: z.string().optional().describe("Filter by service type"),
        petTypes: z.string().optional().describe("Filter by pet species"),
        limit: z.number().default(10).describe("Maximum number of results")
    }),
    func: async ({query, serviceType, petTypes, limit}) => {
        try {
            const serviceService = require('./service.service');

            const filter = {};
            const options = {
                limit: limit,
                page: 1
            };

            if (query) {
                filter.$or = [
                    {name: {$regex: query, $options: 'i'}},
                    {description: {$regex: query, $options: 'i'}}
                ];
            }

            if (petTypes) {
                filter.petTypes = {$in: [petTypes]};
            }

            filter.isVisible = true; // Only show visible services

            const result = await serviceService.getAllServices(filter, options);

            return JSON.stringify({
                success: true,
                services: result.results.map(service => ({
                    id: service._id,
                    name: service.name,
                    description: service.description,
                    price: service.onSale && service.salePrice ? service.salePrice : service.price,
                    originalPrice: service.price,
                    onSale: service.onSale,
                    duration: service.duration,
                    petTypes: service.petTypes,
                    rating: service.rating || 0,
                    available: service.isVisible,
                    image: service.images?.[0]
                })),
                total: result.totalResults
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error searching services: ${ error.message }`
            });
        }
    }
});

const bookAppointmentTool = new DynamicStructuredTool({
    name: "book_appointment",
    description: "Book an appointment for a pet service",
    schema: z.object({
        userId: z.string().describe("User ID booking the appointment"),
        serviceId: z.string().describe("Service ID to book"),
        petIds: z.array(z.string()).describe("Array of Pet IDs for the appointment"),
        appointmentDate: z.string().describe("Preferred appointment date (YYYY-MM-DD)"),
        timeSlot: z.string().describe("Preferred time slot (e.g., 09:00-10:00)"),
        notes: z.string().optional().describe("Additional notes for the appointment"),
        paymentMethod: z.string().default("cash").describe("Payment method: cash or credit_card")
    }),
    func: async ({userId, serviceId, petIds, appointmentDate, timeSlot, notes, paymentMethod}) => {
        try {
            const bookingService = require('./booking.service');
            const serviceService = require('./service.service');
            const petService = require('./pet.service');

            // Verify service exists and is available
            const service = await serviceService.getServiceById(serviceId);
            if (!service || !service.isVisible) {
                return JSON.stringify({
                    success: false,
                    error: "Service not found or not available"
                });
            }

            // Verify all pets belong to user
            for (const petId of petIds) {
                const pet = await petService.getPetById(petId);
                if (!pet || pet.ownerId.toString() !== userId) {
                    return JSON.stringify({
                        success: false,
                        error: `Pet ${ petId } not found or doesn't belong to user`
                    });
                }
            }

            const bookingData = {
                customerId: userId,
                serviceId: serviceId,
                petsId: petIds,
                bookingDate: new Date(appointmentDate),
                timeSlot: timeSlot,
                notes: notes || '',
                paymentMethod: paymentMethod || 'cash'
            };

            const booking = await bookingService.createBooking(bookingData);

            return JSON.stringify({
                success: true,
                booking: {
                    id: booking._id,
                    bookingNumber: booking.bookingNumber,
                    service: service.name,
                    date: appointmentDate,
                    timeSlot: timeSlot,
                    status: booking.status,
                    totalAmount: booking.totalAmount,
                    paymentMethod: booking.paymentMethod
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error booking appointment: ${ error.message }`
            });
        }
    }
});

const addToCartTool = new DynamicStructuredTool({
    name: "add_to_cart",
    description: "Add a product to user's cart",
    schema: z.object({
        userId: z.string().describe("User ID"),
        productId: z.string().describe("Product ID to add"),
        quantity: z.number().default(1).describe("Quantity to add")
    }),
    func: async ({userId, productId, quantity}) => {
        try {
            const cartService = require('./cart.service');
            const productService = require('./product.service');

            // Verify product exists
            const product = await productService.getProductById(productId);
            if (!product) {
                return JSON.stringify({
                    success: false,
                    error: "Product not found"
                });
            }

            if (!product.isVisible) {
                return JSON.stringify({
                    success: false,
                    error: "Product is not available"
                });
            }

            if (product.stock < quantity) {
                return JSON.stringify({
                    success: false,
                    error: "Insufficient inventory"
                });
            }

            const cart = await cartService.addItemToCart(userId, productId, quantity);

            return JSON.stringify({
                success: true,
                message: `Added ${ quantity } ${ product.name } to cart`,
                cart: {
                    totalAmount: cart.totalAmount,
                    itemCount: cart.items.length,
                    items: cart.items.map(item => ({
                        productId: item.productId,
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error adding to cart: ${ error.message }`
            });
        }
    }
});

const getPersonalizedRecommendationsTool = new DynamicStructuredTool({
    name: "get_personalized_recommendations",
    description: "Get personalized product or service recommendations based on user's pets",
    schema: z.object({
        userId: z.string().describe("User ID to get recommendations for"),
        type: z.enum(['products', 'services']).describe("Type of recommendations"),
        limit: z.number().default(5).describe("Maximum number of recommendations")
    }),
    func: async ({userId, type, limit}) => {
        try {
            const petService = require('./pet.service');
            const productService = require('./product.service');
            const serviceService = require('./service.service');
            const orderService = require('./order.service');
            const bookingService = require('./booking.service');

            // Get user's pets
            const petsResult = await petService.getPetsByOwnerId(userId, {}, {limit: 50});
            if (petsResult.results.length === 0) {
                return JSON.stringify({
                    success: false,
                    error: "No pets found for user"
                });
            }

            const pets = petsResult.results;
            const species = [...new Set(pets.map(pet => pet.species))];
            const healthConditions = pets.flatMap(pet =>
                pet.healthRecords?.map(record => record.diagnosis).filter(Boolean) || []
            );

            let recommendations = [];

            if (type === 'products') {
                // Get user's purchase history for better recommendations
                const orderHistory = await orderService.getOrdersByCustomerId(userId, {limit: 10});
                const purchasedCategories = orderHistory.results?.flatMap(order =>
                    order.items?.map(item => item.productId?.categoryId) || []
                ).filter(Boolean) || [];

                const filter = {
                    petTypes: {$in: species},
                    isVisible: true
                };

                // Add health-specific recommendations
                if (healthConditions.length > 0) {
                    filter.$or = [
                        {tags: {$in: healthConditions}},
                        {description: {$regex: healthConditions.join('|'), $options: 'i'}}
                    ];
                }

                const result = await productService.getAllProducts(filter, {
                    limit: limit,
                    page: 1,
                    sortBy: 'rating'
                });

                recommendations = result.results.map(product => ({
                    id: product._id,
                    name: product.name,
                    description: product.description,
                    price: product.onSale && product.salePrice ? product.salePrice : product.price,
                    rating: product.rating || 0,
                    image: product.images?.[0],
                    reason: healthConditions.some(condition =>
                        product.tags?.includes(condition) ||
                        product.description?.toLowerCase().includes(condition.toLowerCase())
                    ) ? 'Health-specific recommendation' : 'Species-specific recommendation'
                }));
            } else {
                // Get user's booking history
                const bookingHistory = await bookingService.getBookingsByCustomerId(userId, {limit: 10});
                const usedServices = bookingHistory.results?.map(booking => booking.serviceId) || [];

                const filter = {
                    petTypes: {$in: species},
                    isVisible: true
                };

                // Exclude already used services if user wants variety
                if (usedServices.length > 0) {
                    filter._id = {$nin: usedServices};
                }

                const result = await serviceService.getAllServices(filter, {
                    limit: limit,
                    page: 1,
                    sortBy: 'rating'
                });

                recommendations = result.results.map(service => ({
                    id: service._id,
                    name: service.name,
                    description: service.description,
                    price: service.onSale && service.salePrice ? service.salePrice : service.price,
                    rating: service.rating || 0,
                    duration: service.duration,
                    image: service.images?.[0],
                    reason: 'Species-specific recommendation'
                }));
            }

            return JSON.stringify({
                success: true,
                userPets: pets.map(pet => ({
                    name: pet.name,
                    species: pet.species,
                    breed: pet.breed,
                    age: pet.age ? Math.floor((new Date() - new Date(pet.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown'
                })),
                recommendations: recommendations,
                type: type
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error getting recommendations: ${ error.message }`
            });
        }
    }
});

const getUserOrderHistoryTool = new DynamicStructuredTool({
    name: "get_user_order_history",
    description: "Get user's order history and purchase patterns",
    schema: z.object({
        userId: z.string().describe("User ID to get order history for"),
        limit: z.number().default(10).describe("Maximum number of orders to retrieve")
    }),
    func: async ({userId, limit}) => {
        try {
            const orderService = require('./order.service');

            const result = await orderService.getOrdersByCustomerId(userId, {
                limit: limit,
                page: 1
            });

            return JSON.stringify({
                success: true,
                orders: result.results.map(order => ({
                    id: order._id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt,
                    items: order.items?.map(item => ({
                        productName: item.productId?.name,
                        quantity: item.quantity,
                        price: item.price
                    })) || []
                })),
                totalOrders: result.totalResults
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error getting order history: ${ error.message }`
            });
        }
    }
});

const getUserBookingHistoryTool = new DynamicStructuredTool({
    name: "get_user_booking_history",
    description: "Get user's booking history for services",
    schema: z.object({
        userId: z.string().describe("User ID to get booking history for"),
        limit: z.number().default(10).describe("Maximum number of bookings to retrieve")
    }),
    func: async ({userId, limit}) => {
        try {
            const bookingService = require('./booking.service');

            const result = await bookingService.getBookingsByCustomerId(userId, {
                limit: limit,
                page: 1
            });

            return JSON.stringify({
                success: true,
                bookings: result.results.map(booking => ({
                    id: booking._id,
                    bookingNumber: booking.bookingNumber,
                    serviceName: booking.serviceId?.name,
                    status: booking.status,
                    bookingDate: booking.bookingDate,
                    timeSlot: booking.timeSlot,
                    totalAmount: booking.totalAmount,
                    pets: booking.petsId?.map(pet => pet.name) || []
                })),
                totalBookings: result.totalResults
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: `Error getting booking history: ${ error.message }`
            });
        }
    }
});

// Create tool list and ToolNode
const tools = [
    getUserPetsTool,
    searchProductsTool,
    searchServicesTool,
    bookAppointmentTool,
    addToCartTool,
    getPersonalizedRecommendationsTool,
    getUserOrderHistoryTool,
    getUserBookingHistoryTool
];

const toolNode = new ToolNode(tools);

// Bind tools to LLM
llm = llm?.bindTools ? llm.bindTools(tools) : llm;

/**
 * Khởi tạo workflow với agents và tools
 */
const initWorkflow = async () => {
    if (persistentExecutor) {
        return persistentExecutor;
    }

    await initRAGService();

    // Bind tools to LLM
    llm = llm.bindTools(tools);

    const workflow = new StateGraph(GraphState);

    // Add only reachable nodes
    workflow.addNode("agent", agent);
    workflow.addNode("tools", toolNode);

    // Build simplified workflow
    workflow.addEdge(START, "agent");

    workflow.addConditionalEdges(
        "agent",
        routeAfterAgent,
        {
            "tools": "tools",
            "end": END
        }
    );

    workflow.addEdge("tools", "agent");

    persistentExecutor = workflow.compile({
        checkpointer: memory,
    });

    return persistentExecutor;
};

/**
 * Chat với enhanced agent capabilities
 */
const chat = async (userId, userQuery) => {
    const threadId = userId || "default-thread";

    const previousState = await memory.get({
        configurable: {
            thread_id: threadId,
            streamMode: "values",
        }
    });

    const historyMessages = previousState?.channel_values?.messages || [];
    const userMessage = {role: "human", content: userQuery};
    const updatedMessages = [...historyMessages, userMessage];

    if (!executor) {
        executor = await initWorkflow();
    }

    const inputs = {
        messages: updatedMessages,
        userId: userId
    };

    try {
        const result = await executor.invoke(inputs, {
            configurable: {
                thread_id: threadId,
                streamMode: "values",
            }
        });

        // Get the final response
        const finalMessages = result.messages || [];
        const lastAssistantMessage = finalMessages
            .filter(msg => msg.role === 'assistant' || msg.constructor.name === 'AIMessage')
            .pop();

        const answer = lastAssistantMessage?.content || result.answer || "Sorry, I couldn't generate a response.";

        // Save conversation to memory
        if (answer) {
            const aiMessage = {role: "assistant", content: answer};
            const newUpdatedMessages = [...updatedMessages, aiMessage];
        }

        return {
            answer: answer
        };
    } catch (error) {
        console.error("Error in pet care chat:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Pet care chat error: ${ error.message }`);
    }
};

/**
 * Xóa lịch sử trò chuyện của một người dùng
 */
const clearChatHistory = async (userId) => {
    const threadId = userId || "default-thread";

    try {
        await memory.delete({
            configurable: {
                thread_id: threadId,
            }
        });

        return {
            success: true,
            message: `Chat history for user ${ userId } has been cleared`
        };
    } catch (error) {
        console.error("Error clearing chat history:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to clear chat history: ${ error.message }`);
    }
};

const getDocuments = async () => {
    return Document.find({}).select("-docIds")
};

const deleteDocument = async (documentId) => {
    try {
        console.log(`Deleting document with ID: ${ documentId }`);

        await initRAGService();
        const result = await Document.findOne({_id: documentId});
        if (!result) {
            throw new ApiError(status.NOT_FOUND, "Document not found");
        }
        await vectorStore.delete({ids: result.docIds});
        await Document.deleteOne({_id: documentId});
        deleteFile(result.fileUrl);
        return {success: true, message: "Document deleted successfully"};
    } catch (error) {
        console.error("Error deleting document:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to delete document: ${ error.message }`);
    }
}

module.exports = {
    initRAGService,
    indexDocument,
    query,
    chat,
    clearChatHistory,
    getDocuments,
    deleteDocument,
};