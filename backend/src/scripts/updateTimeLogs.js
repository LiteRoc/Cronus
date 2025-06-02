const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

(async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log('MongoDB connected.');

        // Update work orders
        const result = await mongoose.connection.db.collection('workorders').updateMany(
            { timeLogs: { $exists: false } },
            { $set: { timeLogs: [] } }
        );

        console.log(`Updated ${result.modifiedCount} work orders.`);
        mongoose.disconnect();
    } catch (error) {
        console.error('Error updating work orders:', error);
        mongoose.disconnect();
    }
})();
