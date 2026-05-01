const dns = require('node:dns');
const mongoose = require('mongoose');

const CONNECTED = 1;
const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};
const SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000);
const SOCKET_TIMEOUT_MS = Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 20000);
const DATABASE_OPERATION_TIMEOUT_MS = Number(process.env.MONGO_OPERATION_TIMEOUT_MS || 6000);
const DNS_SERVER_GROUPS = [
  String(process.env.MONGO_DNS_SERVERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  ['8.8.8.8', '8.8.4.4'],
  ['1.1.1.1', '1.0.0.1'],
].filter((group) => group.length > 0);

mongoose.set('bufferCommands', false);

let connectingPromise = null;
let connectionListenersAttached = false;
let lastConnectionError = null;
let lastAppliedDnsGroupKey = null;

const createDatabaseUnavailableError = (
  message = 'Database unavailable. Check MongoDB Atlas network access and backend MONGO_URI.',
) => {
  const error = new Error(message);
  error.status = 503;
  return error;
};

const isSrvMongoUri = () => String(process.env.MONGO_URI || '').trim().startsWith('mongodb+srv://');

const isSrvResolutionError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');

  return code === 'ECONNREFUSED'
    || code === 'ENOTFOUND'
    || code === 'ETIMEOUT'
    || code === 'EAI_AGAIN'
    || /querysrv|srv/i.test(message);
};

const applyDnsServerGroup = (servers, reason) => {
  if (!servers?.length) {
    return false;
  }

  const groupKey = servers.join(',');
  if (groupKey === lastAppliedDnsGroupKey) {
    return true;
  }

  try {
    dns.setServers(servers);
    lastAppliedDnsGroupKey = groupKey;
    console.log(`Using DNS servers [${groupKey}] for MongoDB resolution (${reason}).`);
    return true;
  } catch (error) {
    console.warn(`Unable to set DNS servers [${groupKey}] (${reason}): ${error.message}`);
    return false;
  }
};

const attachConnectionListeners = () => {
  if (connectionListenersAttached) {
    return;
  }

  connectionListenersAttached = true;

  mongoose.connection.on('connected', () => {
    lastConnectionError = null;
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
  });

  mongoose.connection.on('error', (error) => {
    lastConnectionError = error.message;
    console.error(`MongoDB Runtime Error: ${error.message}`);
  });
};

attachConnectionListeners();

const withTimeout = async (promise, timeoutMs, message) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createDatabaseUnavailableError(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const connectDB = async () => {
  if (mongoose.connection.readyState === CONNECTED) {
    return mongoose.connection;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    const shouldRetrySrvResolution = isSrvMongoUri() && DNS_SERVER_GROUPS.length > 0;
    const maxAttempts = shouldRetrySrvResolution ? DNS_SERVER_GROUPS.length + 1 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const dnsGroup = DNS_SERVER_GROUPS[attempt - 1];

      if (attempt > 0) {
        applyDnsServerGroup(dnsGroup, `fallback-attempt-${attempt}`);
      }

      try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
          socketTimeoutMS: SOCKET_TIMEOUT_MS,
          family: 4,
        });
        lastConnectionError = null;
        return conn.connection;
      } catch (error) {
        lastConnectionError = error.message;
        console.error(`MongoDB Connection Error: ${error.message}`);

        const canRetryWithFallbackDns = shouldRetrySrvResolution
          && isSrvResolutionError(error)
          && attempt < maxAttempts - 1;

        if (!canRetryWithFallbackDns) {
          return null;
        }

        console.warn('MongoDB SRV lookup failed. Retrying with fallback DNS servers...');
      }
    }

    return null;
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
};

const isDatabaseReady = () => mongoose.connection.readyState === CONNECTED;

const getDatabaseStatus = () => ({
  ready: isDatabaseReady(),
  state: READY_STATE_LABELS[mongoose.connection.readyState] || `unknown(${mongoose.connection.readyState})`,
  lastError: lastConnectionError,
});

const runDbOperation = async (
  operation,
  {
    timeoutMs = DATABASE_OPERATION_TIMEOUT_MS,
    errorMessage = 'Database request timed out. Please try again.',
  } = {},
) => {
  if (!isDatabaseReady()) {
    throw createDatabaseUnavailableError();
  }

  return withTimeout(Promise.resolve().then(operation), timeoutMs, errorMessage);
};

module.exports = {
  connectDB,
  isDatabaseReady,
  getDatabaseStatus,
  runDbOperation,
  createDatabaseUnavailableError,
};
