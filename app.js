const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const methodOverride = require('method-override');


app.get('/', (req, res) => {
    res.send('Hello')
});


app.listen(3000, () => {
    console.log('Serving on port 3000')
})