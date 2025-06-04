const express = require('express');
const validate = require('../middlewares/validate.middleware');
const cartValidation = require('../validations');
const {cartController} = require('../controllers');
const {auth} = require('../middlewares/auth.middleware');

const router = express.Router();

router
    .route('/')
    .get(auth, cartController.getCart)
    .post(auth, validate(cartValidation.addToCart.body), cartController.addItemToCart);

router
    .route('/:productId')
    .patch(
        auth,
        validate(cartValidation.updateCartItem.params, 'params'),
        validate(cartValidation.updateCartItem.body),
        cartController.updateCartItem
    )
    .delete(auth, validate(cartValidation.updateCartItem.params, 'params'), cartController.removeCartItem);

router.delete('/clear', auth, cartController.clearCart);

module.exports = router;
