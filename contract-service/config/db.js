import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('MongoDB connected');
    } catch (err) {
        // Driver errors can embed the connection URI, credentials or server data.
        // Only emit a fixed diagnostic category; never the raw error/message.
        const safeNames = ['MongoServerSelectionError', 'MongoNetworkError', 'MongoParseError', 'MongooseServerSelectionError'];
        const category = safeNames.includes(err?.name) ? err.name : 'ConnectionError';
        console.error('MongoDB connection failed:', category);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;
