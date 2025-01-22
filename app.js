var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/user');
var cors=require('cors')
var db = require('./config/connection');
const MongoStore = require('connect-mongo');
var session = require('express-session'); 
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors({
  origin:['https://sample-chatapp-fqwv.onrender.com'], // Your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true  // Allow credentials (cookies) to be sent with requests
}));


const sessionMiddleware = session({
  secret: 'ajinajinshoppingsecretisajin',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://ajinrajeshhillten:qs8gRldbllckrr0N@cluster0.powg3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // Session TTL (1 day)
    autoRemove: 'native',
    touchAfter: 24 * 3600 // Time period in seconds between session updates
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});    
   
app.use(sessionMiddleware)
   
db.connect((err) => {   
  if (err) {
    console.log('Database not connected' + err);
  } else {
    console.log('Database Connected ');
  }
});
app.use('/', indexRouter);

   
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
  
