import mongoose from "mongoose";
import mongooseAutoPopulate from "mongoose-autopopulate";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

// Register plugin only once (mongoose handles duplicate registrations, but we use a flag for clarity)
if (!(global as any).mongoosePluginRegistered) {
  mongoose.plugin(mongooseAutoPopulate);
  (global as any).mongoosePluginRegistered = true;
}

// Connection event listeners for monitoring
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

export const connectDb = async (): Promise<typeof mongoose> => {
  // Return existing connection if available and ready
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If no promise exists, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ Connected to MongoDB");
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; // Clear promise on error
    throw e; // Re-throw error so API routes can handle it
  }

  return cached.conn;
};