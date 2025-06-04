const express = require('express');
const validate = require('../middlewares/validate.middleware');
const userValidation = require('../validations');
const {userController, authController} = require('../controllers');
const {auth, authorize} = require('../middlewares/auth.middleware');
const {userImageUpload} = require('../configs/multer');

const router = express.Router();

// Analytics and statistics routes - Placing at top for visibility
router.get(
    '/analytics',
    auth,
    authorize('admin', 'staff'),
    validate(userValidation.getUserAnalytics.query, 'query'),
    userController.getUserAnalytics
);

router.get(
    '/statistics',
    auth,
    authorize('admin', 'staff'),
    userController.getUserStats
);

router.get(
    '/growth-analysis',
    auth,
    authorize('admin'),
    userController.getGrowthAnalysis
);

// User profile routes
router.get('/me', auth, userController.getProfile);
router.patch(
    '/me/avatar',
    auth,
    userImageUpload.single('avatar'),
    userController.changeAvatar
)
router.patch(
    '/me/password',
    auth,
    validate(userValidation.changePassword.body),
    authController.changePassword
);
router.patch(
    '/me',
    auth,
    validate(userValidation.updateUser.body),
    userController.updateProfile
);

// User address management routes
router.get('/me/addresses', auth, userController.getUserAddresses);
router.post('/me/addresses', auth, validate(userValidation.addAddress.body), userController.addAddress);

router.get('/me/addresses/:addressId', auth, validate(userValidation.getAddress.params, 'params'), userController.getAddress);
router.patch(
    '/me/addresses/:addressId',
    auth,
    validate(userValidation.updateAddress.params, 'params'),
    validate(userValidation.updateAddress.body),
    userController.updateAddress
);
router.delete(
    '/me/addresses/:addressId',
    auth,
    validate(userValidation.deleteAddress.params, 'params'),
    userController.deleteAddress
);

// User role and status management routes
router.patch(
    '/:userId/role',
    auth,
    authorize('admin'),
    validate(userValidation.updateRole.params, 'params'),
    validate(userValidation.updateRole.body),
    userController.updateRole
);
router.patch(
    '/:userId/ban',
    auth,
    authorize('admin'),
    validate(userValidation.banOrUnbanUser.params, 'params'),
    validate(userValidation.banOrUnbanUser.body),
    userController.banOrUnbanUser
);

// Individual user management routes
router.get('/:userId', auth, authorize('admin', 'staff'), validate(userValidation.getUser.params, 'params'), userController.getUser);
router.patch(
    '/:userId',
    auth,
    authorize('admin'),
    validate(userValidation.updateUser.params, 'params'),
    validate(userValidation.updateUser.body),
    userController.updateUser
);
router.delete('/:userId', auth, authorize('admin'), validate(userValidation.updateUser.params, 'params'), userController.deleteUser);

// User collection routes - Define these last as they're the most general
router.get('/', auth, authorize('admin', 'staff'), userController.getUsers);
router.post('/', auth, authorize('admin'), validate(userValidation.createUser.body), userController.createUser);

module.exports = router;
