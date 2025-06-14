const admin = require('firebase-admin');
const path = require('path');
const ApiError = require('../utils/ApiError');
const {status} = require('http-status');

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

/**
 * Send notification to Firestore
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.userId - User ID to send notification to
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.body - Notification body/message
 * @param {string} [notificationData.link] - Optional link to navigate to
 * @returns {Promise<Object>} - Created notification document
 */
const sendNotification = async ({userId, title, body, link}) => {
    // try {
    // Validate required fields
    if (!userId) {
        throw new ApiError(status.BAD_REQUEST, 'User ID is required');
    }
    if (!title) {
        throw new ApiError(status.BAD_REQUEST, 'Title is required');
    }
    if (!body) {
        throw new ApiError(status.BAD_REQUEST, 'Body is required');
    }

    // Create notification data
    const notificationData = {
        userId,
        title,
        body,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add link if provided
    if (link) {
        notificationData.link = link;
    }

    // Add notification to Firestore
    const docRef = await db.collection('notifications').add(notificationData);

    // Return the created notification with ID
    return {
        id: docRef.id,
        ...notificationData,
        createdAt: new Date() // For immediate response, actual timestamp will be set by Firestore
    };
    // } catch (error) {
    //     console.error('Error sending notification:', error);
    //     throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Failed to send notification');
    // }
};

/**
 * Get notifications for a specific user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Limit number of notifications
 * @param {boolean} [options.unreadOnly] - Get only unread notifications
 * @returns {Promise<Array>} - Array of notifications
 */
const getUserNotifications = async (userId, options = {}) => {
    try {
        if (!userId) {
            throw new ApiError(status.BAD_REQUEST, 'User ID is required');
        }

        let query = db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');

        if (options.unreadOnly) {
            query = query.where('isRead', '==', false);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        const notifications = [];

        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return notifications;
    } catch (error) {
        console.error('Error getting user notifications:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Failed to get notifications');
    }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 * @returns {Promise<void>}
 */
const markNotificationAsRead = async (notificationId, userId) => {
    try {
        if (!notificationId) {
            throw new ApiError(status.BAD_REQUEST, 'Notification ID is required');
        }
        if (!userId) {
            throw new ApiError(status.BAD_REQUEST, 'User ID is required');
        }

        const notificationRef = db.collection('notifications').doc(notificationId);
        const doc = await notificationRef.get();

        if (!doc.exists) {
            throw new ApiError(status.NOT_FOUND, 'Notification not found');
        }

        const notificationData = doc.data();
        if (notificationData.userId !== userId) {
            throw new ApiError(status.FORBIDDEN, 'Access denied');
        }

        await notificationRef.update({
            isRead: true,
            readAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Failed to mark notification as read');
    }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const markAllNotificationsAsRead = async (userId) => {
    try {
        if (!userId) {
            throw new ApiError(status.BAD_REQUEST, 'User ID is required');
        }

        const query = db.collection('notifications')
            .where('userId', '==', userId)
            .where('isRead', '==', false);

        const snapshot = await query.get();
        const batch = db.batch();

        snapshot.forEach(doc => {
            batch.update(doc.ref, {
                isRead: true,
                readAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Failed to mark all notifications as read');
    }
};

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 * @returns {Promise<void>}
 */
const deleteNotification = async (notificationId, userId) => {
    try {
        if (!notificationId) {
            throw new ApiError(status.BAD_REQUEST, 'Notification ID is required');
        }
        if (!userId) {
            throw new ApiError(status.BAD_REQUEST, 'User ID is required');
        }

        const notificationRef = db.collection('notifications').doc(notificationId);
        const doc = await notificationRef.get();

        if (!doc.exists) {
            throw new ApiError(status.NOT_FOUND, 'Notification not found');
        }

        const notificationData = doc.data();
        if (notificationData.userId !== userId) {
            throw new ApiError(status.FORBIDDEN, 'Access denied');
        }

        await notificationRef.delete();
    } catch (error) {
        console.error('Error deleting notification:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(status.INTERNAL_SERVER_ERROR, 'Failed to delete notification');
    }
};

module.exports = {
    sendNotification,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    db,
    admin // Export admin instance if needed
};
