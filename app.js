const express = require('express');
var cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const config = require('./config/production');
const port = process.env.PORT || 3000;
const expressValidator = require('express-validator');

mongoose.set('debug', true);

//Product routes
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/videopost');

const app = express();
// This line must come before importing any instrumented module.
const tracer = require('dd-trace').init();

const MAX_RATE = 2000;

app.use(
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour duration in milliseconds
    max: MAX_RATE,
    message: `You exceeded ${MAX_RATE} requests in per hour limit!`,
    headers: true,
  }),
);

//Middleware
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());

//Add routers
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/video', videoRoutes);
app.get('/', function (req, res) {
  res.status(200).json({
    message: 'Successfully access MeetFood API.',
  });
});

//Database
mongoose
  .connect(config.mongodbConnectURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'seefood-database',
  })
  .then(() => {
    console.log('Database Connection is ready...');
    app.listen(port);
  })
  .catch((err) => {
    console.log(err);
  });

module.exports = app;
