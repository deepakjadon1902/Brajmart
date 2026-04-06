import mongoose from 'mongoose';

export const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not set. Running in in-memory mode.');
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.warn('MongoDB connection failed. Running in in-memory mode.', err);
  }
};

export const isDbConnected = () => mongoose.connection.readyState === 1;
