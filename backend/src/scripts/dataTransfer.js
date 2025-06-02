const mongoose = require('mongoose');

// Source database connection
const sourceURI = 'mongodb+srv://feather:8wRE8D9pzLrgiklA@Cronus.es8xb.mongodb.net/Cronus?retryWrites=true&w=majority';
const targetURI = 'mongodb+srv://feather:8wRE8D9pzLrgiklA@Cronus.es8xb.mongodb.net/test?retryWrites=true&w=majority';

// Asset schema
const { assetSchema } = require('../models/Asset'); // Import the schema

const AssetSourceConnection = mongoose.createConnection(sourceURI);
const AssetTargetConnection = mongoose.createConnection(targetURI);

const AssetSource = AssetSourceConnection.model('Asset', assetSchema);
const AssetTarget = AssetTargetConnection.model('Asset', assetSchema);

AssetSourceConnection.on('connected', () => console.log('Source DB connected'));
AssetSourceConnection.on('error', (err) => console.error('Error connecting to Source DB:', err.message));

AssetTargetConnection.on('connected', () => console.log('Target DB connected'));
AssetTargetConnection.on('error', (err) => console.error('Error connecting to Target DB:', err.message));

const transferData = async () => {
    try {
        console.log(`Source Database Name: ${AssetSourceConnection.db.databaseName}`);
        console.log(`Source Collection Name: ${AssetSource.collection.name}`);
        console.log(`Target Database Name: ${AssetTargetConnection.db.databaseName}`);

        const assets = await AssetSource.find({});
        console.log(`Found ${assets.length} assets to transfer.`);

        if (assets.length > 0) {
            await AssetTarget.insertMany(assets);
            console.log('Data transfer complete.');
        } else {
            console.log('No assets found in the source database.');
        }
    } catch (err) {
        console.error('Error transferring data:', err);
    } finally {
        await AssetSourceConnection.close();
        await AssetTargetConnection.close();
    }
};

transferData();
