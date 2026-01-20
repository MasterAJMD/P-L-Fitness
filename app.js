var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const auth = require('./middleware/auth');
const accessLogger = require('./middleware/accessLogger');
const cron = require('node-cron');
const mysql = require('./config/database.js');
require('dotenv').config();

var adminRouter = require('./routes/admin.routes.js');
var attendanceRouter = require('./routes/attendance.routes.js');
var authRouter = require('./routes/auth.routes.js');
var equipmentRouter = require('./routes/equipment.routes.js')
var indexRouter = require('./routes/index');
var membershipsRouter = require('./routes/memberships.routes.js');
var paymentsRouter = require('./routes/payments.routes.js');
var rewardsRouter = require('./routes/rewards.routes.js');
var sessionsRouter = require('./routes/sessions.routes.js');
var usersRouter = require('./routes/users.routes.js');
var vouchersRouter = require('./routes/vouchers.routes.js');
var accessLogRouter = require('./routes/accessLog.routes.js');

var app = express();

// Initialize MySQL connection
mysql.CheckConnection();

// view engine setup (legacy - kept for backward compatibility)
// Note: Frontend now uses React in src/, but EJS views maintained for legacy routes
app.set('views', path.join(__dirname, 'views', 'layout'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Access logging middleware - logs all API requests
app.use('/api/', accessLogger);

// API ROUTES (for React frontend)
// PUBLIC API ROUTES
app.use('/api/auth', authRouter); //LOGIN
app.use('/api/', indexRouter); // LANDING PAGE

// ADMIN API ROUTES (some routes have auth middleware applied individually)
app.use('/api/admin', adminRouter);
app.use('/api/access-logs', accessLogRouter);
app.use('/api/users', auth, usersRouter);
app.use('/api/memberships', auth, membershipsRouter);
app.use('/api/payments', auth, paymentsRouter);
app.use('/api/sessions', auth, sessionsRouter);
app.use('/api/attendance', auth, attendanceRouter);
app.use('/api/vouchers', auth, vouchersRouter);
app.use('/api/rewards', auth, rewardsRouter);
app.use('/api/equipment', auth, equipmentRouter);

// LEGACY EJS ROUTES (kept for backward compatibility)
// Note: React frontend is the primary interface. These routes serve EJS pages if needed.
// In production, React SPA handles all routing on the client side.
if (process.env.LEGACY_EJS_ROUTES === 'true') {
  app.use('/auth', authRouter);
  app.use('/', indexRouter);
  app.use('/admin', auth, adminRouter);
  app.use('/users', auth, usersRouter);
  app.use('/memberships', auth, membershipsRouter);
  app.use('/payments', auth, paymentsRouter);
  app.use('/sessions', auth, sessionsRouter);
  app.use('/attendance', auth, attendanceRouter);
  app.use('/vouchers', auth, vouchersRouter);
  app.use('/rewards', auth, rewardsRouter);
  app.use('/equipment', auth, equipmentRouter);
}

// DAILY POINT IN ATTENDANCE RESET => PASS POINTS TO REWARD POINTS
cron.schedule('0 0 * * *', async () => {
  try {
    await mysql.Query(`
      UPDATE master_attendance
      SET ma_pointsEarned = 0
      WHERE ma_checkout >= DATE_SUB(NOW(), INTERVAL 1 DAY)`);
    console.log("Daily points reset");
  } catch (error) {
    console.error("RESET FAILED: ", error);
  }
});

// WEEKLY POINT IN ATTENDANCE => SUNDAY MIDNIGHT
cron.schedule('0 0 * * 0', async ()=> {
  try {
    await mysql.Query(`
      UPDATE master_attendance
      SET ma_pointsEarned = 0
      WHERE ma_checkout >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    console.log("Weekly points reset");
  } catch (error) {
    console.error("RESET FAILED: ", error);
  }
});

// Serve React build in production (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // If it's an API request, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Otherwise render the error page (for legacy EJS routes)
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
