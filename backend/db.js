const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME   = process.env.DB_NAME   || 'behavioral_bot';

let db;

async function connectDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection('documents').createIndex({ filename: 1 });
  await db.collection('github_data').createIndex({ url: 1 });
  await db.collection('interactions').createIndex({ session_id: 1 });
  console.log('Connected to MongoDB');
}

const getDb = () => db;

module.exports = { connectDb, getDb };
