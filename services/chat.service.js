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
const {StateGraph, END, START, MemorySaver, Annotation, MessagesAnnotation} = require('@langchain/langgraph');
const {TavilySearch} = require('@langchain/tavily');
const {ToolNode} = require('@langchain/langgraph/prebuilt');
const {tool} = require('@langchain/core/tools');
const {HumanMessage, SystemMessage, trimMessages, filterMessages} = require("@langchain/core/messages");
const {z} = require('zod');
const ApiError = require('../utils/ApiError');
const {getPetsByOwnerId} = require('./pet.service')

const memory = new MemorySaver();

const GraphState = Annotation.Root({
    messages: Annotation({
        reducer: (current, newMessage) => {
            if (current === undefined) {
                return [...newMessage];
            }
            return [...current, ...newMessage];
        }
    }),
    userId: Annotation({
        reducer: (current, newUserId) => {
            if (current === undefined) {
                return newUserId;
            }
            return current;
        }
    })
});

let workflow = null;
let vectorStore = null;
let pineconeIndex = null;
let embeddings = null;
let llm = null;

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100,
});

const getPetsByOwnerTool = tool(async ({userId}) => {
    try {
        const results = await getPetsByOwnerId(userId);
        if (!results || !results.results || results.results.length === 0) {
            return "Hiện tại bạn chưa đăng ký thông tin thú cưng nào trong hệ thống. Bạn có muốn thêm thông tin thú cưng của mình không?";
        }

        const pets = results.results;

        // ✅ Calculate statistics
        const totalPets = pets.length;
        const dogCount = pets.filter(pet => pet.species.toLowerCase().includes('chó')).length;
        const catCount = pets.filter(pet => pet.species.toLowerCase().includes('mèo')).length;

        // ✅ Group by species for better organization
        const dogs = pets.filter(pet => pet.species.toLowerCase().includes('dog'));
        const cats = pets.filter(pet => pet.species.toLowerCase().includes('cat'));
        const others = pets.filter(pet => !pet.species.toLowerCase().includes('dog') && !pet.species.toLowerCase().includes('cat'));

        let response = `🐾 **Danh sách thú cưng của bạn** (${ totalPets } con)\n\n`;

        // ✅ Add summary
        if (dogCount > 0 || catCount > 0) {
            const summary = [];
            if (dogCount > 0) summary.push(`${ dogCount } chó`);
            if (catCount > 0) summary.push(`${ catCount } mèo`);
            if (others.length > 0) summary.push(`${ others.length } khác`);
            response += `📊 Tổng quan: ${ summary.join(', ') }\n\n`;
        }

        // ✅ Format dogs section
        if (dogs.length > 0) {
            response += `🐕 **CÁC BÉ CHÓ (${ dogs.length } con):**\n`;
            dogs.forEach((pet, index) => {
                const age = calculateAge(pet.birthDate);
                response += `${ index + 1 }. **${ pet.name }** - ${ pet.breed } ${ pet.gender === 'male' ? '♂️' : '♀️' }\n`;
                response += `   📅 Sinh: ${ formatDate(pet.birthDate) } (${ age })\n\n`;
            });
        }

        // ✅ Format cats section  
        if (cats.length > 0) {
            response += `🐱 **CÁC BÉ MÈO (${ cats.length } con):**\n`;
            cats.forEach((pet, index) => {
                const age = calculateAge(pet.birthDate);
                response += `${ index + 1 }. **${ pet.name }** - ${ pet.breed } ${ pet.gender === 'male' ? '♂️' : '♀️' }\n`;
                response += `   📅 Sinh: ${ formatDate(pet.birthDate) } (${ age })\n\n`;
            });
        }

        // ✅ Format other pets
        if (others.length > 0) {
            response += `🐾 **THÚ CƯNG KHÁC (${ others.length } con):**\n`;
            others.forEach((pet, index) => {
                const age = calculateAge(pet.birthDate);
                response += `${ index + 1 }. **${ pet.name }** - ${ pet.species } ${ pet.breed } ${ pet.gender === 'male' ? '♂️' : '♀️' }\n`;
                response += `   📅 Sinh: ${ formatDate(pet.birthDate) } (${ age })\n\n`;
            });
        }

        return response;

    } catch (error) {
        console.error('Error fetching pets:', error);
        return "Xin lỗi, hiện tại tôi không thể lấy thông tin thú cưng của bạn. Vui lòng thử lại sau.";
    }
}, {
    name: "get_pets_by_owner",
    description: "Lấy thông tin danh sách thú cưng của người dùng cụ thể với format đẹp và dễ đọc. Sử dụng khi khách hàng hỏi về thú cưng của họ như 'thú cưng của tôi', 'con chó/mèo của tôi', hoặc muốn biết thông tin chi tiết về các thú cưng đang nuôi.",
    schema: z.object({
        userId: z.string().describe("ID người dùng cần lấy thông tin thú cưng")
    }),
});

// ✅ Helper functions for formatting
const calculateAge = (birthDate) => {
    if (!birthDate) return 'Chưa rõ tuổi';

    const birth = new Date(birthDate);
    const now = new Date();
    const diffTime = Math.abs(now - birth);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
        return `${ diffDays } ngày tuổi`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${ months } tháng tuổi`;
    } else {
        const years = Math.floor(diffDays / 365);
        const remainingMonths = Math.floor((diffDays % 365) / 30);
        if (remainingMonths > 0) {
            return `${ years } tuổi ${ remainingMonths } tháng`;
        }
        return `${ years } tuổi`;
    }
};

const formatDate = (dateString) => {
    if (!dateString) return 'Chưa rõ';

    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const getServicesTool = tool(async ({query, petType, priceRange}) => {
    try {
        const {getAllServices, searchServices} = require('./service.service');

        const filter = {isVisible: true};
        const options = {page: 1, limit: 6};

        if (petType) {
            filter.petTypes = {$in: [petType]};
        }

        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split('-').map(Number);
            if (minPrice) filter.price = {$gte: minPrice};
            if (maxPrice) filter.price = {...filter.price, $lte: maxPrice};
        }

        let result;

        if (query && query.trim() !== '') {
            result = await searchServices(query, filter, options);
        } else {
            result = await getAllServices(filter, options);
        }

        if (!result.results || result.results.length === 0) {
            return `Không tìm thấy dịch vụ nào phù hợp với "${ query }". Vui lòng thử từ khóa khác.`;
        }

        let response = `🏥 **Tìm thấy ${ result.totalResults } dịch vụ cho "${ query }"**\n\n`;

        result.results.forEach((service, index) => {
            const finalPrice = service.onSale && service.salePrice ? service.salePrice : service.price;
            const originalPrice = service.onSale && service.salePrice ? service.price : null;

            response += `${ index + 1 }. **${ service.name }**\n`;
            response += `   💰 Giá: ${ finalPrice.toLocaleString('vi-VN') }đ`;

            if (originalPrice) {
                response += ` (~~${ originalPrice.toLocaleString('vi-VN') }đ~~) 🔥`;
            }

            response += `\n   ⏰ Thời gian: ${ service.duration } phút\n`;
            response += `   🐾 Phù hợp: ${ service.petTypes ? service.petTypes.join(', ') : 'Tất cả thú cưng' }\n`;

            if (service.ratings && service.ratings.average > 0) {
                response += `   ⭐ Đánh giá: ${ service.ratings.average }/5 (${ service.ratings.count } lượt)\n`;
            }

            if (service.description && service.description.length > 0) {
                const shortDesc = service.description.length > 100
                    ? service.description.substring(0, 100) + '...'
                    : service.description;
                response += `   📝 Mô tả: ${ shortDesc }\n`;
            }

            response += '\n';
        });

        if (result.totalResults > result.results.length) {
            response += `📝 *Hiển thị ${ result.results.length }/${ result.totalResults } dịch vụ. Để đặt lịch hẹn, vui lòng cho tôi biết dịch vụ bạn quan tâm.*`;
        }

        return response;

    } catch (error) {
        console.error('❌ Error in getServicesTool:', error);
        return `Xin lỗi, hiện tại tôi không thể tìm kiếm dịch vụ. Vui lòng thử lại sau hoặc liên hệ với chúng tôi.`;
    }
}, {
    name: "get_services",
    description: "Tìm kiếm dịch vụ chăm sóc thú cưng có sẵn với thông tin chi tiết về giá cả, thời gian và đánh giá. Sử dụng khi khách hàng muốn tìm hiểu dịch vụ, so sánh giá cả, hoặc chuẩn bị đặt lịch hẹn.",
    schema: z.object({
        query: z.string().optional().describe("Loại dịch vụ cần tìm (grooming, spa, khám sức khỏe, huấn luyện, tắm gội...)"),
        petType: z.string().optional().describe("Loài thú cưng cần dịch vụ (chó, mèo, chim...)"),
        priceRange: z.string().optional().describe("Khoảng giá mong muốn (ví dụ: 200000-500000)")
    }),
});

const getProductsTool = tool(async ({query, category, petType, priceRange}) => {
    try {
        console.log("Hello");

        const {getAllProducts, searchProducts} = require('./product.service');

        const filter = {isVisible: true};
        const options = {page: 1, limit: 8};

        if (petType) {
            filter.petTypes = {$in: [petType]};
        }

        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split('-').map(Number);
            if (minPrice) filter.price = {$gte: minPrice};
            if (maxPrice) filter.price = {...filter.price, $lte: maxPrice};
        }

        let result;

        if (query && query.trim() !== '') {
            result = await searchProducts(query, {...filter, ...options});
        } else {
            result = await getAllProducts(filter, options);
        }

        if (!result.results || result.results.length === 0) {
            return `Không tìm thấy sản phẩm nào phù hợp với "${ query }". Vui lòng thử từ khóa khác hoặc mở rộng tiêu chí tìm kiếm.`;
        }

        let response = `🛍️ **Tìm thấy ${ result.totalResults } sản phẩm cho "${ query }"**\n\n`;

        result.results.forEach((product, index) => {
            const finalPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
            const originalPrice = product.onSale && product.salePrice ? product.price : null;

            response += `${ index + 1 }. **${ product.name }**\n`;
            response += `   💰 Giá: ${ finalPrice.toLocaleString('vi-VN') }đ`;

            if (originalPrice) {
                response += ` (~~${ originalPrice.toLocaleString('vi-VN') }đ~~) 🔥`;
            }

            response += `\n   🏪 Thương hiệu: ${ product.brand || 'Chưa rõ' }\n`;
            response += `   📦 Số lượng hàng: ${ product.stock > 0 ? `${ product.stock } sản phẩm` : 'Hết hàng' }\n`;

            if (product.ratings && product.ratings.average > 0) {
                response += `   ⭐ Đánh giá: ${ product.ratings.average }/5 (${ product.ratings.count } lượt)\n`;
            }

            response += '\n';
        });

        if (result.totalResults > result.results.length) {
            response += `📝 *Hiển thị ${ result.results.length }/${ result.totalResults } sản phẩm. Hãy cụ thể hóa tìm kiếm để có kết quả chính xác hơn.*`;
        }

        return response;

    } catch (error) {
        console.error('❌ Error in getProductsTool:', error);
        return `Xin lỗi, hiện tại tôi không thể tìm kiếm sản phẩm. Vui lòng thử lại sau hoặc liên hệ với chúng tôi.`;
    }
}, {
    name: "get_products",
    description: "Tìm kiếm sản phẩm thú cưng để mua với thông tin chi tiết về giá cả, tồn kho và đánh giá. Sử dụng khi khách hàng muốn mua sản phẩm cụ thể, xem giá cả, kiểm tra tồn kho hoặc so sánh sản phẩm.",
    schema: z.object({
        query: z.string().describe("Từ khóa tìm kiếm sản phẩm (tên sản phẩm, thương hiệu, loại sản phẩm)"),
        petType: z.string().optional().describe("Loài thú cưng (chó, mèo, chim, cá...)"),
        priceRange: z.string().optional().describe("Khoảng giá (ví dụ: 100000-500000)")
    }),
});

const retrieveDocumentTool = tool(async ({query}) => {
    if (!vectorStore) {
        throw new ApiError(status.INTERNAL_SERVER_ERROR, "Vector store is not initialized");
    }
    const results = await vectorStore.similaritySearch(query, 5);
    console.log("Retrieved documents:", results);

    const result2 = results.map(doc => {
        return doc.pageContent
    })
    console.log(result2);
    return result2.join("\n\n");

}, {
    name: "retrieve_documents",
    description: "Tìm kiếm và trả về thông tin chi tiết từ tài liệu chuyên môn về chăm sóc thú cưng, hướng dẫn nuôi dưỡng, dinh dưỡng, sức khỏe thú cưng. Sử dụng khi cần thông tin chuyên sâu, hướng dẫn chi tiết hoặc lời khuyên từ chuyên gia.",
    schema: z.object({
        query: z.string().describe("The search query for retrieving documents")
    }),
});

const tools = [getPetsByOwnerTool, getServicesTool, getProductsTool, retrieveDocumentTool];
const toolNode = new ToolNode(tools);

const initRAGService = async () => {
    if (llm && vectorStore && pineconeIndex) {
        return;
    }
    llm = new ChatGroq({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.7,
    }).bindTools(tools);
    embeddings = new PineconeEmbeddings({
        model: process.env.EMBEDDING_MODEL || "multilingual-e5-large"
    });
    const pinecone = new PineconeClient();
    pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

    vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
    });
}

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

const agent = async (state) => {
    const {messages} = state;
    const systemMessage = new SystemMessage(`Bạn là trợ lý AI cho hệ thống chăm sóc thú cưng.
NHIỆM VỤ: Phân tích câu hỏi và quyết định phản hồi phù hợp.

🔍 **KIỂM TRA LỊCH SỬ TRƯỚC KHI HÀNH ĐỘNG:**
- Đọc toàn bộ tin nhắn trước đó để xem đã có dữ liệu chưa
- Nếu đã có kết quả từ tool (tin nhắn có format "🏥 **Tìm thấy..." hoặc "🛍️ **Tìm thấy..."), KHÔNG gọi tool nữa
- Chỉ gọi tool khi thực sự cần dữ liệu mới

📋 **HƯỚNG DẪN XỬ LÝ:**
1. Chào hỏi đơn giản (xin chào, hello) → trả lời thân thiện ngay
2. Đã có dữ liệu trong lịch sử → sử dụng dữ liệu đó để trả lời, KHÔNG gọi tool
3. Cần dữ liệu mới → gọi tool phù hợp
4. Thiếu thông tin để gọi tool → hỏi thêm thông tin

🛠️ **CHỌN CÔNG CỤ KHI CẦN:**
- retrieve_documents: 
  * Kiến thức chuyên sâu (bệnh, điều trị, chăm sóc, hành vi, dinh dưỡng)
  * Hướng dẫn sử dụng hệ thống (cách đặt lịch, cách mua sản phẩm, quy trình sử dụng)
  * Câu hỏi có từ "cách", "làm thế nào", "hướng dẫn", "quy trình"
- get_pets_by_owner: thú cưng của người dùng, chỉ cần gọi khi bạn cần biết thú cưng đó là loài gì
- get_products: tìm kiếm danh sách sản phẩm có sẵn (query rỗng nếu không nói sản phẩm cụ thể)
- get_services: tìm kiếm danh sách dịch vụ có sẵn (query rỗng nếu không nói dịch vụ cụ thể)

⚡ **QUY TẮC QUAN TRỌNG:**
- BẮT BUỘC: Chỉ được gọi tool bằng tool_calls, TUYỆT ĐỐI KHÔNG viết <function=...>{...}
- NGHIÊM CẤM: Không được trả về content có dạng <function=name>{json} và nhắc đến tool cho người dùng
- NẾU CẦN TOOL: Sử dụng tool_calls thông qua LangChain binding
- get_services: petType là tùy chọn (dog/cat hoặc bỏ trống)
- Nếu đã có danh sách dịch vụ/sản phẩm, hãy dùng chúng để trả lời
- Trả lời tự nhiên như người tư vấn thực sự

🎯 **PHÂN BIỆT INTENT:**
- "Cách đặt lịch", "làm thế nào để...", "hướng dẫn..." → retrieve_documents
- "Dịch vụ nào có sẵn", "giá dịch vụ", "tìm dịch vụ" → get_services
- "Sản phẩm nào có", "giá sản phẩm", "mua gì" → get_products

QUAN TRỌNG: Khi cần gọi tool, hãy gọi trực tiếp thông qua tool_calls, KHÔNG BAO GIỜ viết ra text mô tả việc gọi tool.

👤 User ID: ${ state.userId || 'unknown' }`);

    const response = await llm.invoke([systemMessage, ...messages.slice(-5)]);
    console.log("Response ", response);

    return {messages: [response]};
    // return {message: [...messages]}
}

const shouldContinue = (state) => {
    const {messages} = state;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.tool_calls?.length) {
        return "tools";
    }
    return END;
}

const initWorkflow = async () => {
    if (workflow) {
        return workflow;
    }
    await initRAGService();

    const graph = new StateGraph(GraphState)
        .addNode("agent", agent)
        .addNode("tools", toolNode)
        .addEdge("__start__", "agent")
        .addEdge("tools", "agent")
        .addConditionalEdges("agent", shouldContinue, {
            tools: "tools",
            __end__: END
        })

    workflow = graph.compile({
        checkpointer: memory,
    });
    return workflow;
}

const chat = async (userId, question) => {
    if (!workflow) {
        workflow = await initWorkflow();
    }

    const messages = [new HumanMessage(question)];

    const result = await workflow.invoke({messages: [...messages], userId}, {
        configurable: {
            thread_id: userId,
        }
    });
    const responseMessage = result.messages[result.messages.length - 1];

    return {
        answer: responseMessage.content,
        toolCalls: responseMessage.tool_calls || [],
    };
}

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
    indexDocument,
    chat,
    getDocuments,
    deleteDocument,
}