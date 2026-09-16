import { webcrypto } from 'node:crypto';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';

const FORBIDDEN_CONFIGURED_URI = 'mongodb://configured-database-access-is-forbidden.invalid/blocked';

process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';

function assertMemoryServerUri(candidate, approvedBaseUri) {
  if (typeof candidate !== 'string' || !candidate.startsWith(approvedBaseUri.split('?')[0])) {
    throw new Error('Tests refused a MongoDB URI not issued by MongoMemoryServer');
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('Tests require a loopback-only MongoMemoryServer URI');
  }
}

function guardedMongoose(mongooseClient, approvedBaseUri) {
  const originalConnect = mongooseClient.connect.bind(mongooseClient);
  mongooseClient.connect = async (uri, ...args) => {
    assertMemoryServerUri(uri, approvedBaseUri);
    return originalConnect(uri, ...args);
  };

  return () => {
    mongooseClient.connect = originalConnect;
  };
}

export async function createIsolatedMongoHarness(mongooseClient, { replicaSet = false } = {}) {
  process.env.MONGO_URI = FORBIDDEN_CONFIGURED_URI;

  // The installed replica-set driver's crypto API is not global in Node 18 Jest.
  if (replicaSet && !globalThis.crypto) globalThis.crypto = webcrypto;

  const server = replicaSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' } })
    : await MongoMemoryServer.create({ instance: { dbName: 'cronus_core_contact_test_bootstrap' } });
  const baseUri = server.getUri();
  assertMemoryServerUri(baseUri, baseUri);

  const restoreGuard = guardedMongoose(mongooseClient, baseUri);
  const testUri = server.getUri('cronus_core_contact_test');
  try {
    assertMemoryServerUri(testUri, baseUri);
    await mongooseClient.connect(testUri);
  } catch (error) {
    await mongooseClient.disconnect();
    restoreGuard();
    await server.stop();
    throw error;
  }

  return {
    async stop() {
      try {
        await mongooseClient.connection.dropDatabase();
      } finally {
        try { await mongooseClient.disconnect(); }
        finally { restoreGuard(); await server.stop(); }
      }
    },
  };
}
