require('dotenv').config(); // Load environment variables from .env file
const admin = require('firebase-admin');

// Initialize Firebase using environment variable
const serviceAccountString = process.env.FIREBASECONFIGS;
if (!serviceAccountString) {
    throw new Error('FIREBASECONFIGS environment variable is not set');
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountString);
} catch (error) {
    throw new Error('Error parsing FIREBASECONFIGS environment variable: ' + error.message);
}

if (!serviceAccount.project_id) {
    throw new Error('Service account object must contain a string "project_id" property.');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'alkaline-tesseract.firebasestorage.app', // Replace with your Firebase Storage bucket
    projectId: 'alkaline-tesseract',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
module.exports = { db, bucket }