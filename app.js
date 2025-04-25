const express = require('express');
const app = express();

app.use(express.json());

const routes = require('./routes/index');
app.use('/api', routes);

module.exports = app;
