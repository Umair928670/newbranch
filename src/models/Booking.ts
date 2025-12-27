import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  rideId: { type: String, ref: 'Ride', required: true, index: true },
  passengerId: { type: String, ref: 'User', required: true, index: true },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected", "cancelled"], 
    required: true 
  },
  seatsBooked: { type: Number, default: 1 },
  unreadCount: {
    type: Map,
    of: Number,
    default: {} 
  },
  lastMessage: {
    content: String,
    senderId: String,
    timestamp: Date,
    messageType: { type: String, default: 'text' }
  }
});

export const BookingModel = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

