require('dotenv').config(); // Load environment variables
const { MongoClient } = require('mongodb');

const url = process.env.MONGO_URI; // Load MongoDB URI from environment
const dbName = 'Cronus';

async function connectToDb() {
    if (!url) throw new Error('MONGO_URI is missing. Check your .env file.');
    const client = await MongoClient.connect(url);
    console.log('Connected to MongoDB');
    return client;
}

async function updateAssets() {
    try {
        const client = await connectToDb();
        const db = client.db(dbName);

        console.log('Connected to MongoDB');

        // Update all assets, adding a default status of 'Active' if not already set
        const result = await db.collection('assets').updateMany({ status: { $exists: false } }, { $set: { status: 'Active' } });
        console.log(`Updated ${result.modifiedCount} assets`);

        // Close the database connection
        await client.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error updating assets:', error);
    }
}

updateAssets();
