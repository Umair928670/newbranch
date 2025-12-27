import mongoose from "mongoose";
import "dotenv/config";

async function reset() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/unipool";
  
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  
  console.log("⚠️ DROPPING DATABASE...");
  await mongoose.connection.db?.dropDatabase();
  
  console.log("✅ Database cleared successfully!");
  process.exit(0);
}

reset().catch(console.error);