import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var _mongooseConnectPromise: Promise<void> | undefined;
}

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.warn("⚠️ MONGODB_URI is missing in .env file! Falling back to local DB");
    }

    const connectionString = uri || "mongodb://127.0.0.1:27017/unipool";

    // Reuse existing connection if ready
    if (mongoose.connection.readyState === 1) return;

    // If a connection attempt is in progress, await it.
    // FIX: Only reuse the promise if the connection is connecting (2) or connected (1).
    // If it is disconnected (0) or disconnecting (3), we should create a new promise.
    if (global._mongooseConnectPromise && mongoose.connection.readyState !== 0) {
      return global._mongooseConnectPromise;
    }

    global._mongooseConnectPromise = mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 5000, // Fail faster if no internet/db
    }).then(() => {
      const logUri = connectionString.replace(/:([^:@]+)@/, ":****@");
      console.log(`✅ Connected to MongoDB: ${logUri}`);
    }).catch((error) => {
      console.error("❌ MongoDB connection error:", error);
      delete (global as any)._mongooseConnectPromise;
      throw error;
    }).then(() => undefined);

    return global._mongooseConnectPromise;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}