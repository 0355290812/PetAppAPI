const {status} = require('http-status');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const ApiError = require('../utils/ApiError');

/**
 * Get cart by user id
 * @param {ObjectId} userId
 * @returns {Promise<Cart>}
 */
const getCartByUserId = async (userId) => {
    let cart = await Cart.findOne({userId}).populate('items.productId');

    // Create a cart if it doesn't exist
    if (!cart) {
        cart = await Cart.create({
            userId,
            items: [],
            totalAmount: 0
        });
    }

    cart.items = cart.items.map(item => ({
        ...item,
        name: item.productId.name,
        image: item.productId.images && item.productId.images.length > 0 ? item.productId.images[0] : null,
        price: item.productId.onSale && item.productId.salePrice ? item.productId.salePrice : item.productId.price
    }));

    return cart;
};

/**
 * Add item to cart
 * @param {ObjectId} userId
 * @param {Object} itemData
 * @returns {Promise<Cart>}
 */
const addItemToCart = async (userId, productId, quantity) => {
    // Validate product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    if (!product.isVisible) {
        throw new ApiError(status.BAD_REQUEST, 'Product is not available');
    }

    if (product.stock < quantity) {
        throw new ApiError(status.BAD_REQUEST, 'Not enough product in stock');
    }

    let cart = await getCartByUserId(userId);

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item =>
        item.productId._id.toString() === productId.toString()
    );

    // Get the current price (regular or sale price)
    const currentPrice = product.onSale && product.salePrice ? product.salePrice : product.price;

    if (existingItemIndex !== -1) {
        // Update existing item
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].price = currentPrice;
    } else {
        // Add new item
        cart.items.push({
            productId,
            name: product.name,
            price: currentPrice,
            quantity,
            image: product.images && product.images.length > 0 ? product.images[0] : null
        });
    }

    // Recalculate cart total
    cart.totalAmount = cart.items.reduce(
        (total, item) => total + (item.price * item.quantity),
        0
    );

    await cart.save();
    return cart;
};

/**
 * Update cart item quantity
 * @param {ObjectId} userId
 * @param {ObjectId} productId
 * @param {number} quantity - New quantity
 * @returns {Promise<Cart>}
 */
const updateCartItemQuantity = async (userId, productId, quantity) => {
    if (quantity < 1) {
        throw new ApiError(status.BAD_REQUEST, 'Quantity must be at least 1');
    }

    // Validate product exists and has enough stock
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(status.NOT_FOUND, 'Product not found');
    }

    if (product.stock < quantity) {
        throw new ApiError(status.BAD_REQUEST, 'Not enough product in stock');
    }

    const cart = await getCartByUserId(userId);

    const itemIndex = cart.items.findIndex(item =>
        item.productId._id.toString() === productId.toString()
    );

    if (itemIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Item not found in cart');
    }

    cart.items[itemIndex].quantity = quantity;

    // Recalculate cart total
    cart.totalAmount = cart.items.reduce(
        (total, item) => total + (item.price * item.quantity),
        0
    );

    await cart.save();
    return cart;
};

/**
 * Remove item from cart
 * @param {ObjectId} userId
 * @param {ObjectId} productId
 * @returns {Promise<Cart>}
 */
const removeCartItem = async (userId, productId) => {
    const cart = await getCartByUserId(userId);
    console.log(cart);


    const itemIndex = cart.items.findIndex(item =>
        item.productId._id.toString() === productId.toString()
    );

    if (itemIndex === -1) {
        throw new ApiError(status.NOT_FOUND, 'Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    // Recalculate cart total
    cart.totalAmount = cart.items.reduce(
        (total, item) => total + (item.price * item.quantity),
        0
    );

    await cart.save();
    return cart;
};

/**
 * Clear cart
 * @param {ObjectId} userId
 * @returns {Promise<Cart>}
 */
const clearCart = async (userId) => {
    const cart = await getCartByUserId(userId);

    cart.items = [];
    cart.totalAmount = 0;

    await cart.save();
    return cart;
};

/**
 * Validate cart items (check if all items are still available and have enough stock)
 * @param {ObjectId} userId
 * @returns {Promise<Object>} - Validation result
 */
const validateCartItems = async (userId) => {
    const cart = await getCartByUserId(userId);

    if (cart.items.length === 0) {
        throw new ApiError(status.BAD_REQUEST, 'Cart is empty');
    }

    const validationResults = {
        valid: true,
        invalidItems: [],
        cart
    };

    // Check each item
    for (const item of cart.items) {
        const product = await Product.findById(item.productId);

        if (!product || !product.isVisible || product.stock < item.quantity) {
            validationResults.valid = false;
            validationResults.invalidItems.push({
                productId: item.productId,
                name: item.name,
                reason: !product ? 'Product not found' :
                    !product.isVisible ? 'Product is not available' :
                        'Not enough stock'
            });
        }
    }

    return validationResults;
};

module.exports = {
    getCartByUserId,
    addItemToCart,
    updateCartItemQuantity,
    removeCartItem,
    clearCart,
    validateCartItems
};
