const {status} = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {authService, userService} = require('../services');
const ApiError = require('../utils/ApiError');

const register = catchAsync(async (req, res) => {
    const user = await authService.registerUser(req.body);
    const tokens = await authService.generateAuthTokens(user);
    res.status(status.CREATED).send({user, tokens});
});

const login = catchAsync(async (req, res) => {
    const {email, password} = req.body;
    const user = await authService.loginUserWithEmailAndPassword(email, password);
    const tokens = await authService.generateAuthTokens(user);
    res.send({user, tokens});
});

const refreshTokens = catchAsync(async (req, res) => {
    const tokens = await authService.refreshAuth(req.body.refreshToken);
    res.send({...tokens});
});

const forgotPassword = catchAsync(async (req, res) => {
    const resetPasswordToken = await authService.generateResetPasswordToken(req.body.email);
    // In a real app, you would send an email with the token
    // For development, we'll just return the token
    res.status(status.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
    await authService.resetPassword(req.query.token, req.body.password);
    res.status(status.NO_CONTENT).send();
});

const verifyEmail = catchAsync(async (req, res) => {
    await authService.verifyEmail(req.query.token);
    res.status(status.NO_CONTENT).send();
});



const changePassword = catchAsync(async (req, res) => {
    const {currentPassword, newPassword} = req.body;
    const user = await userService.getUserById(req.user._id);

    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // Verify current password
    const isPasswordValid = await userService.isPasswordMatch(user, currentPassword);
    if (!isPasswordValid) {
        throw new ApiError(status.UNAUTHORIZED, 'Sai mật khẩu');
    }

    // Update to new password
    await userService.updateUserById(req.user._id, {password: newPassword});
    res.status(status.NO_CONTENT).send();
});

const changeAvatar = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    if (!user) {
        throw new ApiError(status.NOT_FOUND, 'User not found');
    }

    // Update avatar
    const avatarPath = getFilePath(req.file);
    await userService.updateUserById(req.user._id, {avatar: avatarPath}, req.user);
    res.send({avatar: avatarPath});
});

module.exports = {
    register,
    login,
    refreshTokens,
    forgotPassword,
    resetPassword,
    verifyEmail,
    changePassword,
    changeAvatar,
};
