var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const auth = require('./middleware/auth');
const cron = require('node-cron');
const mysql = require('./services/dbconnect.js');
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

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views', 'layout'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// PUBLIC ROUTES
app.use('/auth', authRouter); //LOGIN
app.use('/', indexRouter); // LANDING PAGE
// app.use('/admin', adminRouter); // FOR SEEDED ADMIN
// app.use('/users', usersRouter);


// PROTECTED ROUTES
app.use('/admin', auth, adminRouter);
app.use('/users', auth, usersRouter);
app.use('/memberships', auth, membershipsRouter);
app.use('/payments', auth, paymentsRouter);
app.use('/sessions', auth, sessionsRouter);
app.use('/attendance', auth, attendanceRouter);
app.use('/vouchers', auth, vouchersRouter);
app.use('/rewards', auth, rewardsRouter);
app.use('/equipment', auth, equipmentRouter);

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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
