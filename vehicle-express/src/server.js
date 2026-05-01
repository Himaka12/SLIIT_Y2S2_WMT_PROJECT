const dns = require('node:dns');
const os = require('os');

dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, isDatabaseReady, getDatabaseStatus } = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const bookingRoutes = require('./routes/bookings');
const refundRoutes = require('./routes/refunds');
const reviewRoutes = require('./routes/reviews');
const inquiryRoutes = require('./routes/inquiries');
const promotionRoutes = require('./routes/promotions');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const wishlistRoutes = require('./routes/wishlist');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_RETRY_INTERVAL_MS = 15000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => {
  const databaseStatus = getDatabaseStatus();

  res.status(databaseStatus.ready ? 200 : 503).json({
    status: databaseStatus.ready ? 'ok' : 'degraded',
    database: databaseStatus.state,
    lastError: databaseStatus.lastError,
    message: databaseStatus.ready
      ? 'Vehicle API is running.'
      : 'Vehicle API is running, but MongoDB is unavailable.',
  });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (!isDatabaseReady()) {
    return res.status(503).json({
      message: 'Database unavailable. Check MongoDB Atlas network access and backend MONGO_URI.',
    });
  }

  return next();
});

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal Server Error' });
});

const getLanUrls = () => {
  const interfaces = os.networkInterfaces();

  return Object.values(interfaces)
    .flat()
    .filter(Boolean)
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${PORT}`);
};

const attemptDatabaseConnection = async (reason) => {
  console.log(`${reason} MongoDB connection...`);
  const connection = await connectDB();
  if (connection) {
    await seedAdmin();
  }
};

const startDatabaseReconnectLoop = () => {
  setInterval(async () => {
    if (isDatabaseReady()) {
      return;
    }

    await attemptDatabaseConnection('Retrying');
  }, DB_RETRY_INTERVAL_MS);
};

const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vehicle API running on http://localhost:${PORT}`);
    getLanUrls().forEach((url) => console.log(`Vehicle API LAN URL: ${url}`));

    if (!isDatabaseReady()) {
      console.log('Vehicle API is listening before MongoDB is ready. Requests will return 503 until the database reconnects.');
    }
  });

  void attemptDatabaseConnection('Attempting initial');
  startDatabaseReconnectLoop();
};

startServer();
