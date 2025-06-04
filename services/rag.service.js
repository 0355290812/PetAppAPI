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
const {StateGraph, END, START, MemorySaver} = require('@langchain/langgraph');
const {TavilySearch} = require('@langchain/tavily');
const ApiError = require('../utils/ApiError');

const memory = new MemorySaver();

let executor = null;

// Một executor duy nhất cho tất cả các cuộc hội thoại
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
 * @returns {Promise<void>}
 */
const initRAGService = async () => {
    if (llm && vectorStore && embeddings) {
        return; // Đã khởi tạo rồi
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
        namespace: "pet_care", // Thêm namespace cho hệ thống chăm sóc thú cưng
    });

    console.log("Pet Care RAG service initialized successfully");
};

/**
 * Load tài liệu dựa vào định dạng file
 * @param {string} filePath - Đường dẫn tới file
 * @returns {Promise<Document[]>} - Mảng các document đã load
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
 * @param {string} filePath - Đường dẫn đến file
 * @returns {Promise<Object>} - Kết quả indexing
 */
const indexDocument = async (filePath) => {
    await initRAGService();

    // Kiểm tra định dạng file có hỗ trợ không
    const fileExtension = path.extname(filePath).toLowerCase();
    if (!['.pdf', '.txt'].includes(fileExtension)) {
        throw new ApiError(status.BAD_REQUEST, "Unsupported file format. Only PDF and TXT files are supported.");
    }

    try {
        // Đọc tên file để lưu vào metadata
        const fileName = path.basename(filePath);

        // Tải tài liệu theo định dạng
        const docs = await loadDocumentByFormat(filePath);

        // Thêm metadata cho tên file
        docs.forEach(doc => {
            doc.metadata.fileName = fileName;
            doc.metadata.sourceFile = filePath;
        });

        // Chia nhỏ tài liệu
        const splitDocs = await textSplitter.splitDocuments(docs);

        // Thêm tài liệu vào vector store
        const batchSize = 96;
        const batches = [];

        for (let i = 0; i < splitDocs.length; i += batchSize) {
            const batch = splitDocs.slice(i, i + batchSize);
            batches.push(batch);
        }

        // Gửi song song tất cả batch:
        await Promise.all(
            batches.map((batch, index) => {
                console.log(`Uploading batch ${ index + 1 }/${ batches.length }`);
                return vectorStore.addDocuments(batch);
            })
        );

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
 * @param {string} userQuery - Câu hỏi của người dùng
 * @param {string} systemPrompt - System prompt (tùy chọn)
 * @returns {Promise<Object>} Kết quả trả về
 */
const query = async (userQuery, systemPrompt = "You are a helpful pet care assistant. Provide accurate and helpful information about pet health, nutrition, training, and general care.") => {
    await initRAGService();

    // Tìm kiếm tài liệu liên quan từ vector store
    const embedQuery = await embeddings.embedQuery(userQuery);

    const searchResults = await vectorStore.similaritySearchVectorWithScore(
        embedQuery,
        4 // Lấy 4 kết quả liên quan nhất cho thông tin thú cưng chính xác hơn
    );

    // Kết hợp nội dung từ các tài liệu tìm được
    const contextText = searchResults
        .map(([doc, score]) => `${ doc.pageContent } (Relevance: ${ score.toFixed(2) })`)
        .join("\n\n");

    // Tạo system prompt với context cho hệ thống chăm sóc thú cưng
    const enhancedSystemPrompt = `${ systemPrompt }\n\nContext from pet care knowledge base:\n${ contextText }\n\nIf information isn't available in the context, clarify this and provide general pet care advice while encouraging consultation with a veterinarian for health concerns.`;

    // Gửi truy vấn đến LLM
    const response = await llm.invoke([
        ["system", enhancedSystemPrompt],
        ["human", userQuery]
    ]);

    // Kết quả trả về
    return {
        answer: response.content,
        sources: searchResults.map(([doc, score]) => ({
            content: doc.pageContent.substring(0, 200) + "...", // Hiển thị preview
            metadata: doc.metadata,
            score: score
        }))
    };
};

/**
 * Lọc tin nhắn lịch sử dựa trên độ liên quan với tin nhắn hiện tại sử dụng embeddings
 * @param {Array} messages - Mảng các tin nhắn
 * @param {string} currentMessage - Tin nhắn hiện tại
 * @param {number} maxMessages - Số lượng tin nhắn tối đa trả về
 * @returns {Promise<Array>} - Mảng các tin nhắn liên quan nhất
 */
const getRelevantHistory = async (messages, currentMessage, maxMessages = 5) => {
    if (messages.length <= maxMessages) {
        return messages; // Nếu số tin nhắn ít hơn giới hạn, trả về toàn bộ
    }

    try {
        // Generate embedding cho tin nhắn hiện tại
        const currentEmbedding = await embeddings.embedQuery(currentMessage);
        
        // Generate embeddings cho tất cả tin nhắn lịch sử
        const messageTexts = messages.map(m => m.content);
        const messageEmbeddings = await Promise.all(
            messageTexts.map(async (text) => {
                return await embeddings.embedQuery(text);
            })
        );
        
        // Tính toán điểm tương đồng (dot product)
        const similarities = messageEmbeddings.map(embedding => {
            return embedding.reduce((sum, val, i) => sum + val * currentEmbedding[i], 0);
        });
        
        // Tạo mảng kết hợp message và điểm tương đồng
        const messagesWithScores = messages.map((message, index) => ({
            message,
            score: similarities[index]
        }));
        
        // Sắp xếp theo độ tương đồng giảm dần
        messagesWithScores.sort((a, b) => b.score - a.score);
        
        // Lấy các tin nhắn liên quan nhất
        return messagesWithScores.slice(0, maxMessages).map(item => item.message);
    } catch (error) {
        console.error("Error filtering relevant history:", error);
        // Fallback: trả về các tin nhắn gần đây nhất
        return messages.slice(-maxMessages);
    }
};

/**
 * Quyết định xem LLM có cần lấy thêm thông tin hay không dựa theo tin nhắn cuối
 * @param {Object} state - Trạng thái hiện tại của hội thoại
 * @returns {Promise<string>} - Quyết định "retrieve" hoặc "direct_response"
 */
const shouldRetrieve = async (state) => {
    console.log("---DECIDE TO RETRIEVE---");
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    
    // Lọc ra tin nhắn liên quan nhất với tin nhắn hiện tại
    const relevantMessages = await getRelevantHistory(
        messages.slice(0, messages.length - 1), // Tất cả tin nhắn trừ tin nhắn hiện tại
        lastMessage.content,
        7 // Lấy tối đa 7 tin nhắn liên quan nhất
    );
    
    // Thêm tin nhắn hiện tại vào cuối
    const filteredHistory = [...relevantMessages, lastMessage];
    
    // Tạo context từ tin nhắn đã lọc để LLM hiểu được cuộc trò chuyện
    const conversationHistory = filteredHistory.map(m => 
        `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');
    
    // Sử dụng LLM để phân tích câu hỏi và quyết định có cần retrieve không
    const systemPrompt = `
    You are a pet care assistant analyzer. Your job is to determine if the user's message requires retrieving information from the knowledge base.
    
    ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
    Current message: "${lastMessage.content}"

    Messages that should trigger retrieval:
    - Questions about pet health, nutrition, training, or care
    - Queries about pet breeds or specific pet behaviors
    - Questions about pet medical conditions or treatments
    - Requests for pet product recommendations
    - Follow-up questions that require additional pet care information
    - Questions that reference previous pet-related information but need elaboration

    Messages that do NOT need retrieval (respond with "direct_response"):
    - Simple greetings or acknowledgments
    - User expressions of gratitude
    - Follow-up clarification questions that can be answered based on your previous response
    - Simple yes/no responses from the user
    - Questions unrelated to pet care
    - Messages where the needed information was already provided in previous responses

    Consider the conversation history to determine if this is a follow-up question that needs new information or can be answered with what was already discussed.
    
    Respond with ONLY "retrieve" if pet care information retrieval is needed, or "direct_response" if retrieval is not necessary.
    `;

    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", "Should I retrieve information for this message considering the conversation history?"]
    ]);
    
    const decision = response.content.toLowerCase().trim();
    
    if (decision.includes("retrieve")) {
        console.log("---DECISION: RETRIEVE (LLM analysis with conversation history)---");
        return "retrieve";
    }
    
    console.log("---DECISION: DIRECT_RESPONSE (LLM analysis with conversation history)---");
    return "direct_response";
};

/**
 * Trả lời trực tiếp không cần lấy thông tin từ knowledge base
 * @param {Object} state - Trạng thái hiện tại
 * @returns {Promise<Object>} - Trạng thái với câu trả lời trực tiếp
 */
const directResponse = async (state) => {
    console.log("---DIRECT RESPONSE---");
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    // Lọc ra tin nhắn liên quan nhất với tin nhắn hiện tại
    const relevantMessages = await getRelevantHistory(
        messages.slice(0, messages.length - 1),
        lastMessage.content,
        7
    );
    
    // Thêm tin nhắn hiện tại vào cuối
    const filteredHistory = [...relevantMessages, lastMessage];
    
    // Tạo context từ tin nhắn đã lọc
    const conversationHistory = filteredHistory.map(m => 
        `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    // Phân tích tin nhắn để xác định chủ đề
    const topicAnalysisPrompt = `
    You are a pet care topic analyzer. Analyze this message and determine if it's:
    1. A greeting or conversation pleasantry
    2. A question about pet care
    3. A question unrelated to pet care
    4. A follow-up to previous information
    
    ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
    Current message: "${lastMessage.content}"
    
    Respond with ONLY "greeting", "pet_related", "non_pet_related", or "follow_up".
    `;

    const topicAnalysis = await llm.invoke([
        ["system", topicAnalysisPrompt],
        ["human", "Which category does this message fall into?"]
    ]);

    const topic = topicAnalysis.content.toLowerCase().trim();
    let responsePrompt;

    if (topic.includes("greeting")) {
        responsePrompt = `
        You are a friendly pet care assistant. Respond warmly to this greeting or pleasantry.
        ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
        Current message: "${lastMessage.content}"
        Keep your response concise and friendly, and mention that you're here to help with pet care questions.
        `;
    } else if (topic.includes("follow_up")) {
        responsePrompt = `
        You are a helpful pet care assistant. This is a follow-up question to previous information.
        
        ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
        Current message: "${lastMessage.content}"
        
        Reference the information from your previous responses to provide a helpful answer.
        If you need to clarify something you previously said, do so.
        Be consistent with your previous advice but provide additional details if needed.
        `;
    } else if (topic.includes("pet_related")) {
        responsePrompt = `
        You are a helpful pet care assistant. This appears to be a simple pet-related question that doesn't need retrieval from our knowledge base.
        ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
        Current message: "${lastMessage.content}"
        Respond helpfully based on general pet care knowledge, but remind the user that for detailed pet health questions, veterinary advice is recommended.
        `;
    } else {
        // Chủ đề không liên quan đến thú cưng
        responsePrompt = `
        You are a helpful pet care assistant. This question appears to be outside your primary knowledge domain of pet care.
        ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
        Current message: "${lastMessage.content}"
        
        Politely inform the user that you specialize in pet care information and may not have accurate information about other topics.
        Suggest that they ask you about pet health, nutrition, training, or general pet care instead.
        Be friendly but clear about your limitations.
        `;
    }

    const response = await llm.invoke([
        ["system", responsePrompt],
        ["human", lastMessage.content]
    ]);

    return {
        answer: response.content,
        sources: "Direct response referencing conversation history"
    };
};

/**
 * Đánh giá độ liên quan của tài liệu đã lấy về
 * @param {Object} state - Trạng thái hiện tại
 * @returns {Promise<Object>} - Trạng thái mới với tin nhắn đánh giá
 */
const gradeDocuments = async (state) => {
    console.log("---GET RELEVANCE---");
    const {messages, context} = state;

    // Đánh giá mức độ liên quan của văn bản đã lấy
    const query = messages[0].content;

    const systemPrompt = `
    You are an evaluator assessing the relevance of retrieved documents to a user question.
    User question: ${ query }
    Retrieved documents: ${ context }
    
    Determine if the documents are relevant to the question. 
    Give your answer as either "yes" or "no".`;

    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", "Are these documents relevant to the question?"]
    ]);

    // Phân tích câu trả lời để xác định độ liên quan
    const relevanceScore = response.content.toLowerCase().includes("yes") ? "yes" : "no";

    return {
        messages: [...messages],
        relevanceScore: relevanceScore,
    };
};

/**
 * Kiểm tra độ liên quan của tài liệu
 * @param {Object} state - Trạng thái hiện tại
 * @returns {string} - "yes" nếu liên quan, "no" nếu không
 */
const checkRelevance = (state) => {
    console.log("---CHECK RELEVANCE---");
    return state.relevanceScore || "no";
};

/**
 * Viết lại câu truy vấn để cải thiện kết quả tìm kiếm
 * @param {Object} state - Trạng thái hiện tại
 * @returns {Promise<Object>} - Trạng thái với câu truy vấn mới
 */
const rewrite = async (state) => {
    console.log("---TRANSFORM QUERY---");
    const {messages} = state;
    const originalQuery = messages[messages.length - 1].content;
    
    // Lọc ra tin nhắn liên quan nhất với truy vấn hiện tại
    const relevantMessages = await getRelevantHistory(
        messages.slice(0, messages.length - 1),
        originalQuery,
        5
    );
    
    // Tạo context từ tin nhắn đã lọc
    const conversationHistory = relevantMessages.map(m => 
        `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    const systemPrompt = `
    You are a pet care search specialist. Look at the input question about pets or pet care and try to reason about the underlying semantic intent/meaning.
    ${conversationHistory ? `Conversation history:\n${conversationHistory}\n\n` : ''}
    Original question: "${originalQuery}"
    
    Formulate an improved search query that would help retrieve more relevant information about pet care, health, nutrition, or training.
    Consider any relevant context from the conversation history.
    Include specific pet-related terms that might be in our database.
    Limit the length of the new query to 300 characters.`;

    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", "Please rewrite this pet care question to improve search results while considering conversation history"]
    ]);

    // Thay thế truy vấn gốc bằng truy vấn được viết lại
    // Giữ lại truy vấn gốc trong originalQuery để khi trả lời LLM có thể tham chiếu
    return {
        messages: [
            ...messages.slice(0, messages.length - 1),
            {role: "human", content: response.content}
        ],
        originalQuery: originalQuery
    };
};

/**
 * Thực hiện tìm kiếm web qua Tavily khi không tìm thấy thông tin trong vector store
 * @param {Object} state - Trạng thái hiện tại
 * @returns {Promise<Object>} - Trạng thái với kết quả từ web
 */
const webSearch = async (state) => {
    console.log("---WEB SEARCH---");
    const {messages, originalQuery} = state;
    const query = messages[0].content;

    console.log("Web search query:", query);


    try {
        // Sử dụng Tavily để tìm kiếm web
        const searchTool = new TavilySearch({
            apiKey: process.env.TAVILY_API_KEY,
            maxResults: 3
        });

        const searchResults = await searchTool.invoke({query});
        console.log("Web search results:", searchResults);
        const webContext = searchResults.results.map(result =>
            `Title: ${ result.title }\nContent: ${ result.content }\nSource: ${ result.url }`
        ).join('\n\n');

        return {
            messages: messages,
            originalQuery: originalQuery || query,
            context: webContext,
            usingWebSearch: true
        };
    } catch (error) {
        console.error("Error in web search:", error);
        return {
            messages: messages,
            originalQuery: originalQuery || query,
            context: "No relevant information found from web search.",
            usingWebSearch: true
        };
    }
};

/**
 * Tạo câu trả lời dựa trên thông tin đã lấy được
 * @param {Object} state - Trạng thái hiện tại
 * @returns {Promise<Object>} - Trạng thái với câu trả lời
 */
const generate = async (state) => {
    console.log("---GENERATE---");
    const {messages, context, originalQuery, usingWebSearch} = state;
    
    // Lọc ra tin nhắn liên quan nhất với truy vấn hiện tại
    const relevantMessages = await getRelevantHistory(
        messages.slice(0, messages.length - 1),
        messages[messages.length - 1].content,
        5
    );
    
    // Tạo context từ tin nhắn đã lọc
    const conversationHistory = relevantMessages.map(m => 
        `${m.role === 'human' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n\n');

    // Xây dựng system prompt với context cho hệ thống chăm sóc thú cưng
    let systemPrompt = "You are a helpful pet care assistant. Provide accurate information about pet health, nutrition, behavior, training, and general care based on the provided context.";

    if (usingWebSearch) {
        systemPrompt += " The information comes from web search, so cite sources when possible. Always remind users to consult with veterinarians for specific medical advice.";
    } else {
        systemPrompt += " If you don't know the answer or it's not in the context, say so and suggest consulting with a veterinarian for specific medical questions.";
    }
    
    if (conversationHistory) {
        systemPrompt += `\n\nConversation history:\n${conversationHistory}`;
    }

    systemPrompt += `\n\nContext information:\n${context}`;

    // Sử dụng query gốc nếu có
    const query = originalQuery || messages[messages.length - 1].content;

    // Gửi truy vấn đến LLM
    const response = await llm.invoke([
        ["system", systemPrompt],
        ["human", query],
    ]);

    console.log("Generated pet care response:", response.content);

    return {
        answer: response.content,
        sources: usingWebSearch ? "Web search results" : "Pet care knowledge base"
    };
};

/**
 * Khởi tạo workflow một lần và sử dụng lại
 * @returns {Promise<Object>} - Workflow đã được compile
 */
const initWorkflow = async () => {
    if (persistentExecutor) {
        return persistentExecutor; // Trả về executor đã khởi tạo
    }

    // Khởi tạo RAG service nếu cần
    await initRAGService();

    // Tạo workflow graph
    const workflow = new StateGraph({
        channels: {
            messages: {type: "list", default: []},
            context: {type: "string", default: ""},
            relevanceScore: {type: "string", default: ""},
            originalQuery: {type: "string", default: ""},
            usingWebSearch: {type: "boolean", default: false},
            needWebSearch: {type: "boolean", default: false},
            answer: {type: "string", default: ""},
            documents: {type: "list", default: []}
        }
    });

    // Thêm các node
    workflow.addNode("agent", async (state) => {
        console.log("---PET CARE AGENT NODE---");
        console.log(state);

        return {
            ...state,
            fromAgent: true
        };
    });

    workflow.addNode("directResponse", directResponse);
    workflow.addNode("retrieve", async (state) => {
        // Tìm kiếm tài liệu liên quan từ vector store
        console.log("---RETRIEVE PET INFO NODE---");
        const embedQuery = await embeddings.embedQuery(state.messages[0].content);
        const searchResults = await vectorStore.similaritySearchVectorWithScore(
            embedQuery,
            4 // Lấy 4 kết quả liên quan nhất cho thông tin thú cưng
        );

        // Kết hợp nội dung từ các tài liệu tìm được và thêm metadata
        const contextText = searchResults
            .map(([doc, score]) => {
                const metadata = doc.metadata || {};
                const source = metadata.fileName || metadata.sourceFile || "unknown source";
                return `${ doc.pageContent }\n(Source: ${ source }, Relevance: ${ score.toFixed(2) })`;
            })
            .join("\n\n");

        return {
            ...state,
            context: contextText,
            documents: searchResults.map(([doc, score]) => ({
                content: doc.pageContent,
                metadata: doc.metadata,
                score: score
            }))
        };
    });

    workflow.addNode("gradeDocuments", gradeDocuments);
    workflow.addNode("rewrite", rewrite);
    workflow.addNode("webSearch", webSearch);
    workflow.addNode("generate", generate);
    workflow.addNode("checkSecondAttempt", async (state) => {
        console.log("---CHECK SECOND ATTEMPT---");
        if (state.originalQuery) {
            return {
                ...state,
                needWebSearch: true
            };
        }
        return state;
    });

    // Xây dựng luồng xử lý
    workflow.addEdge(START, "agent");
    workflow.addConditionalEdges(
        "agent",
        shouldRetrieve,
        {
            "retrieve": "retrieve",
            "direct_response": "directResponse"
        }
    );
    workflow.addEdge("directResponse", END);
    workflow.addEdge("retrieve", "gradeDocuments");
    workflow.addConditionalEdges(
        "gradeDocuments",
        checkRelevance,
        {
            "yes": "generate",
            "no": "checkSecondAttempt"
        }
    );
    workflow.addConditionalEdges(
        "checkSecondAttempt",
        (state) => state.needWebSearch ? "webSearch" : "rewrite",
        {
            "webSearch": "webSearch",
            "rewrite": "rewrite"
        }
    );
    workflow.addEdge("rewrite", "retrieve");
    workflow.addEdge("webSearch", "generate");
    workflow.addEdge("generate", END);

    // Compile workflow không cần memorySaver
    persistentExecutor = workflow.compile({
        checkpointer: memory,
    });

    return persistentExecutor;
};

/**
 * Chat với context từ vector database và LangGraph workflow
 * @param {string} userQuery - Câu hỏi của người dùng
 * @param {string} userId - ID của người dùng (opional)
 * @returns {Promise<Object>} Kết quả trò chuyện
 */
const chat = async (userQuery, userId) => {
    const threadId = userId || "default-thread";

    // Lấy lại history từ memory saver
    const previousState = await memory.get({
        configurable: {
            thread_id: threadId,
            streamMode: "values",
        }
    });
    console.log("Previous state:", previousState?.channel_values);

    const historyMessages = previousState?.channel_values?.messages || [];

    // Thêm tin nhắn mới
    const userMessage = {role: "human", content: userQuery};
    const updatedMessages = [...historyMessages, userMessage];
    console.log("Updated messages:", updatedMessages);

    // Lấy hoặc khởi tạo executor nếu cần
    if (!executor) {
        executor = await initWorkflow();
    }

    const inputs = {
        messages: updatedMessages,
        context: "",
        relevanceScore: "",
        originalQuery: "",
        usingWebSearch: false,
        needWebSearch: false,
        documents: []
    };

    let finalResult = null;
    let sources = [];

    try {
        const result = await executor.invoke(inputs, {
            configurable: {
                thread_id: threadId,
                streamMode: "values",
            }
        });

        console.log("Workflow result:", result);

        if (result.answer) {
            finalResult = result.answer;
            
            // Thêm câu trả lời của AI vào lịch sử
            const aiMessage = {role: "assistant", content: result.answer};
            const newUpdatedMessages = [...updatedMessages, aiMessage];
            
            // Lưu lịch sử mới vào memory - cải tiến phần này để tránh lỗi
            try {
                // Tạo một checkpoint mới thay vì cập nhật checkpoint hiện tại
                const checkpointConfig = {
                    thread_id: threadId,
                };
                
                // Lưu dữ liệu với chỉ messages mới, tránh sử dụng previousState
                await memory.put({
                    configurable: checkpointConfig,
                    channel_values: {
                        messages: newUpdatedMessages
                    }
                });
                
                console.log("Successfully saved chat history with AI response");
            } catch (memoryError) {
                console.error("Error saving to memory, but continuing:", memoryError);
                // Tiếp tục mà không dừng lại nếu lưu memory thất bại
            }
        }

        if (result.documents && result.documents.length > 0) {
            sources = result.documents;
        }
    } catch (error) {
        console.error("Error in pet care chat:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Pet care chat error: ${error.message}`);
    }

    return {
        answer: finalResult,
        // sources: sources.length > 0 ? sources : "No specific sources"
    };
};

/**
 * Lưu tin nhắn vào bộ nhớ một cách an toàn
 * @param {string} threadId - ID của thread
 * @param {Array} messages - Mảng các tin nhắn
 * @returns {Promise<boolean>} - Kết quả lưu
 */
const saveChatHistorySafely = async (threadId, messages) => {
    try {
        // Tạo checkpoint mới để tránh lỗi
        await memory.delete({
            configurable: {
                thread_id: threadId,
            }
        });
        
        // Sau khi xóa, tạo mới để tránh conflict
        await memory.put({
            configurable: {
                thread_id: threadId,
            },
            channel_values: {
                messages: messages
            }
        });
        
        return true;
    } catch (error) {
        console.error("Error safely saving chat history:", error);
        return false;
    }
};

/**
 * Xóa lịch sử trò chuyện của một người dùng
 * @param {string} userId - ID của người dùng
 * @returns {Promise<Object>} - Kết quả xóa lịch sử
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
            message: `Chat history for user ${userId} has been cleared`
        };
    } catch (error) {
        console.error("Error clearing chat history:", error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, `Failed to clear chat history: ${error.message}`);
    }
};

// Cập nhật exports để bao gồm phương thức xóa lịch sử
module.exports = {
    initRAGService,
    indexDocument,
    query,
    chat,
    clearChatHistory,
    saveChatHistorySafely
};