const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const admin = require('firebase-admin');
const path = require('path');
const appointmentsRouter = require('./routes/appointments');
const doctorsRouter = require('./routes/doctors');
const hmsRouter = require('./routes/hms');
const videoRouter = require('./routes/video');

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('Environment variables loaded:');
console.log('HMS_ACCESS_KEY:', process.env.HMS_ACCESS_KEY ? 'Present' : 'Missing');
console.log('HMS_SECRET_KEY:', process.env.HMS_SECRET_KEY ? 'Present' : 'Missing');
console.log('HMS_MANAGEMENT_TOKEN:', process.env.HMS_MANAGEMENT_TOKEN ? 'Present' : 'Missing');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const app = express();

// Configure CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

app.use(express.json());
app.use(morgan('dev'));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/hms', hmsRouter);
app.use('/api/video', videoRouter);

// Test route to check if the server is running
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Serve static files from the React frontend app in production
if (process.env.NODE_ENV === 'production') {
  // Serve any static files
  app.use(express.static(path.join(__dirname, '../build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', function(req, res) {
    // Skip API routes
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../build', 'index.html'));
    }
  });
}

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});