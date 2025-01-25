const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Database connection
const db = require('./config/connection');

// Routers
const indexRouter = require('./routes/user');

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CORS Configuration
app.use(cors({
  origin: 'https://sample-chatapp-fqwv.onrender.com', // Your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Session Configuration
const sessionMiddleware = session({const sessionMiddleware = session({
  secret: 'your_strong_secret_key_here',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://ajinrajeshhillten:qs8gRldbllckrr0N@cluster0.powg3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // Session expires in 24 hours
    autoRemove: 'disabled', // Manually manage session removal
    touchAfter: 24 * 3600 // Update session only once in 24 hours
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false, // Set to true in production
    httpOnly: true,
    sameSite: 'lax'
  }
});

// Custom session cleanup method
function cleanupExpiredSessions() {
  sessionMiddleware.store.clear((err) => {
    if (err) {
      console.error('Session cleanup error:', err);
    } else {
      console.log('Expired sessions cleared');
    }
  });
}

// Run cleanup periodically
setInterval(cleanupExpiredSessions, 24 * 60 * 60 * 1000); // Every 24 hours
app.use(sessionMiddleware);

// Database connection
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database Connected');
  }
});

// Routes
app.use('/', indexRouter);

// 404 handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
