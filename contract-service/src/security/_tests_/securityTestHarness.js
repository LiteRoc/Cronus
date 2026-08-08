import { MongoMemoryServer } from "mongodb-memory-server";

const FORBIDDEN_CONFIGURED_URI = "mongodb://configured-database-access-is-forbidden.invalid/blocked";

function assertMemoryServerUri(candidate, approvedBaseUri) {
  if (typeof candidate !== "string" || !candidate.startsWith(approvedBaseUri)) {
    throw new Error("Security tests refused a MongoDB URI not issued by MongoMemoryServer");
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== "mongodb:" || !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error("Security tests require a loopback-only MongoMemoryServer URI");
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

  // Never download a MongoDB binary during the test run. If no cached binary is
  // available, setup must fail closed before any test or database connection.
  process.env.MONGOMS_RUNTIME_DOWNLOAD = "false";
export async function createIsolatedMongoHarness({ coreMongoose, contractMongoose }) {
  // Never inspect or retain a configured URI. Any application code that tries to use
  // MONGO_URI receives a deliberately unusable sentinel instead.
  process.env.MONGO_URI = FORBIDDEN_CONFIGURED_URI;

  const server = await MongoMemoryServer.create({
    instance: { dbName: "cronus_security_test_bootstrap" },
  });
  const baseUri = server.getUri();
  assertMemoryServerUri(baseUri, baseUri);

  const restoreCoreGuard = guardedMongoose(coreMongoose, baseUri);
  const restoreContractGuard = guardedMongoose(contractMongoose, baseUri);
  const coreUri = server.getUri("cronus_core_auth_security_test");
  const contractUri = server.getUri("cronus_contract_auth_security_test");

  assertMemoryServerUri(coreUri, baseUri);
  assertMemoryServerUri(contractUri, baseUri);

  await coreMongoose.connect(coreUri);
  await contractMongoose.connect(contractUri);

  return {
    coreUri,
    contractUri,
    async stop() {
      await Promise.all([
        coreMongoose.connection.dropDatabase(),
        contractMongoose.connection.dropDatabase(),
      ]);
      await Promise.all([
        coreMongoose.disconnect(),
        contractMongoose.disconnect(),
      ]);
      restoreCoreGuard();
      restoreContractGuard();
      await server.stop();
    },
  };
}

