import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  rideId: { type: String, ref: 'Ride', required: true },
  reviewerId: { type: String, ref: 'User', required: true },
  revieweeId: { type: String, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

export const ReviewModel = mongoose.models.Review || mongoose.model("Review", reviewSchema);

