const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {cartService} = require('../services');
const ApiError = require('../utils/ApiError');

const getCart = catchAsync(async (req, res) => {
    const cart = await cartService.getCartByUserId(req.user._id);
    res.send(cart);
});

const addItemToCart = catchAsync(async (req, res) => {
    const {productId, quantity} = req.body;
    const cart = await cartService.addItemToCart(req.user._id, productId, quantity);
    res.send(cart);
});

const updateCartItem = catchAsync(async (req, res) => {
    const {quantity} = req.body;
    const {productId} = req.params;
    const cart = await cartService.updateCartItemQuantity(req.user._id, productId, quantity);
    res.send(cart);
});

const removeCartItem = catchAsync(async (req, res) => {
    const cart = await cartService.removeCartItem(req.user._id, req.params.productId);
    res.send(cart);
});

const clearCart = catchAsync(async (req, res) => {
    await cartService.clearCart(req.user._id);
    res.status(status.NO_CONTENT).send();
});

module.exports = {
    getCart,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
};
