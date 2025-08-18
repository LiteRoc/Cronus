const express = require('express');
const debug = require('debug')('app:adminRouter');
const { MongoClient } = require('mongodb');
//const assets = require('../data/assets.json');
const workOrders = require('../data/workorders.json');

const adminRouter = express.Router();

adminRouter.route('/').get(async (req, res) => {
    const url = process.env.MONGO_URI; // Use environment variable
    const dbName = 'Cronus';

        let client;
        try {
            // Connect to the MongoDb client
            client = await MongoClient.connect(url);
            debug('Connected to Mongo Db');

            // Get the database and collection
            const db = client.db(dbName);
            const collection = db.collection('workOrders');

            // Insert many assets
            const response = await db.collection('workOrders').insertMany(workOrders);

            // send the response
            res.status(200).json(response);
        } catch(error) {
            debug(error.stack);

            // send the error message
            res.status(500).json({ error: 'An error occurred while inserting work orders.' });
        } finally {
            // Ensure the MongoDb client is closed
            if (client) {
                await client.close();
                debug('MongoDb connection closed')
            }
        }
    });

module.exports = adminRouter;