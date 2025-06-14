const cron = require('node-cron');
const {deleteExpiredBookings} = require('../services/booking.service');
const {deleteExpiredOrders} = require('../services/order.service');

cron.schedule('* * * * *', async () => {
    await deleteExpiredBookings();
    await deleteExpiredOrders();
}, {
    timezone: "Asia/Ho_Chi_Minh"
});



