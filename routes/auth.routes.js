const express = require('express');
const validate = require('../middlewares/validate.middleware');
const authValidation = require('../validations');
const {authController} = require('../controllers');
const {auth} = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', validate(authValidation.register.body), authController.register);
router.post('/login', validate(authValidation.login.body), authController.login);
router.post('/refresh-tokens', validate(authValidation.refreshTokens.body), authController.refreshTokens);
// router.post('/forgot-password', validate(authValidation.forgotPassword.body), authController.forgotPassword);
// router.post('/reset-password',
//     validate(authValidation.resetPassword.query, 'query'),
//     validate(authValidation.resetPassword.body),
//     authController.resetPassword
// );
// router.post('/verify-email', validate(authValidation.verifyEmail.query, 'query'), authController.verifyEmail);
// router.get('/profile', auth, authController.getProfile);
// router.patch('/profile', auth, validate(authValidation.updateUser.body), authController.updateProfile);
// router.patch('/change-avatar', auth, userImageUpload.single('avatar'), authController.changeAvatar);
// router.post('/change-password', auth, validate(authValidation.changePassword.body), authController.changePassword);

module.exports = router;
