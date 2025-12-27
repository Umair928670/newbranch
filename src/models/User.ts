import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  clerkId: { type: String, default: null },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["passenger", "driver", "both"], required: true, index: true },
  avatar: { type: String, default: null },
  phone: { type: String, default: null },
  cnic: { type: String, default: null },
  cnicStatus: { 
    type: String, 
    enum: ["not_uploaded", "pending", "verified", "rejected"], 
    default: "not_uploaded" 
  },
  isAdmin: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  pushNotifications: { type: Boolean, default: true },
  marketingNotifications: { type: Boolean, default: false }
});

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

