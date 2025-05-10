# BioNexa Backend Setup

## Prerequisites
1. Node.js and npm installed
2. MongoDB installed and running locally
3. Firebase project setup with Admin SDK

## Setup Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the following variables in `.env`:
     - `MONGODB_URI`: MongoDB connection string
     - `PORT`: Server port (default: 5000)
     - `GOOGLE_APPLICATION_CREDENTIALS`: Path to Firebase Admin SDK service account key

3. Set up Firebase Admin SDK:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Save the JSON file in a secure location
   - Update `GOOGLE_APPLICATION_CREDENTIALS` in `.env` with the path

4. Start the server:
   - Development mode: `npm run dev`
   - Production mode: `npm start`

## API Endpoints

### Users
- POST `/api/users/profile`: Create/Update user profile
- GET `/api/users/profile`: Get user profile

### Appointments
- GET `/api/appointments`: Get all appointments
- POST `/api/appointments`: Create new appointment
- PATCH `/api/appointments/:id`: Update appointment status

### Prescriptions
- GET `/api/prescriptions`: Get all prescriptions
- POST `/api/prescriptions`: Create new prescription
- GET `/api/prescriptions/:id`: Get prescription by ID