const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

(async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log('MongoDB connected.');

        // Define the time increment (in minutes)
        const timeIncrement = 60;

        // Update all work orders
        const result = await mongoose.connection.db.collection('workorders').updateMany(
            {}, // Apply to all documents
            { $inc: { timeSpent: timeIncrement } } // Increment timeSpent
        );

        console.log(`Updated ${result.modifiedCount} work orders, added ${timeIncrement} minutes to each.`);
        mongoose.disconnect();
    } catch (error) {
        console.error('Error updating work orders:', error);
        mongoose.disconnect();
    }
})();
