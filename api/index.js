const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { db, bucket } = require('./firebase');
const admin = require('firebase-admin');

// Express app setup
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// CORS Configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://aurahunt.octphysicsclub.org');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Dashboard Endpoint
app.get('/dashboard', async (req, res) => {
  const docId = req.query.docId;
  if (!docId) {
    return res.redirect('/');
  }
  try {
    const co2ReadingsSnapshot = await db.collection('readings').doc(docId).collection('co2').orderBy('timestamp', 'desc').get();
    const filterStatusDoc = await db.collection('readings').doc(docId).get();

    let co2Data = [];
    let lastUpdated = null;
    co2ReadingsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.co2 && data.timestamp) {
        const timestamp = new Date(data.timestamp._seconds * 1000);
        co2Data.push({
          co2: data.co2,
          timestamp: timestamp.toLocaleTimeString(),
        });
        if (!lastUpdated) {
          lastUpdated = getTimeAgo(timestamp);
        }
      }
    });

    const filterOn = filterStatusDoc.exists ? filterStatusDoc.data().filterOn || false : false;
    res.render('dashboard', { co2Data, filterOn, docId, lastUpdated });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to get human-readable time ago string
function getTimeAgo(timestamp) {
  const now = Date.now();
  const difference = now - timestamp + 2 * 60 * 60 * 1000;

  const seconds = Math.floor(difference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 7) return `${days} days ago`;
  if (weeks < 4) return `${weeks} weeks ago`;
  return `${months} months ago`;
}

// Toggle filter status route (for AJAX requests)
app.post('/toggle-filter', async (req, res) => {
  const username = req.body.docId;
  const newFilterStatus = req.body.filterOn === 'true';
  try {
    await db.collection('readings').doc(username).update({
      filterOn: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    res.json({ success: true, filterOn: newFilterStatus });
  } catch (error) {
    console.error('Error updating filter status:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
