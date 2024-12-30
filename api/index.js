const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { db } = require('./firebase');
const admin = require('firebase-admin');
const { log } = require('console');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/dashboard', async (req, res) => {
  const docId = req.query.docId;
  if (!docId) {
    return res.redirect('/');
  }
  try {
    const co2ReadingsSnapshot = await db
      .collection('readings')
      .doc(docId)
      .collection('co2')
      .orderBy('timestamp', 'desc')
      .get();

    const filterStatusDoc = await db.collection('readings').doc(docId).get();

    let co2Data = [];
    let lastUpdated = null;
    if (co2ReadingsSnapshot.size > 0) {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      let firstValidTimestamp = null;
      co2ReadingsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.co2 && data.timestamp) {
          const currentTimestamp = data.timestamp._seconds * 1000 - 2 * 60 * 60 * 1000
          if (currentTimestamp >= oneHourAgo) {
            if (!firstValidTimestamp) {
              firstValidTimestamp = currentTimestamp;
            }

            const secondsSinceFirst = Math.round(
              (currentTimestamp - firstValidTimestamp) / 1000
            );

            co2Data.push({
              y: data.co2,
              x: secondsSinceFirst,
            });

            if (!lastUpdated) {
              lastUpdated = getTimeAgo(currentTimestamp);
            }
          }
        }
      });
      console.log(co2Data);

      if (!co2Data[0]) {
        co2ReadingsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data && data.co2 && data.timestamp) {
            const currentTimestamp = data.timestamp._seconds * 1000 - 2 * 60 * 60 * 1000
            if (!firstValidTimestamp) {
              firstValidTimestamp = currentTimestamp;
            }

            const secondsSinceFirst = Math.round(
              (currentTimestamp - firstValidTimestamp) / 1000
            );

            co2Data.push({
              y: data.co2,
              x: secondsSinceFirst,
            });

            if (!lastUpdated) {
              lastUpdated = getTimeAgo(currentTimestamp);
            }
          }
        });
      }
    }
    co2Data = co2Data.map(co2 => { return { x: co2.x + Math.abs(co2Data[co2Data.length - 1].x), y: co2.y } })
    const filterOn = filterStatusDoc.exists
      ? filterStatusDoc.data().filterOn || false
      : false;
    res.render('dashboard', { co2Data, filterOn, docId, lastUpdated });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

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

app.post('/toggle-filter', async (req, res) => {
  const username = req.body.docId;
  const newFilterStatus = req.body.filterOn === 'true';
  try {
    await db.collection('readings').doc(username).update({
      filterOn: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    res.json({ success: true, filterOn: newFilterStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});