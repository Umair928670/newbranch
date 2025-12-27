import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  bookingId: { type: String, ref: 'Booking', required: true },
  senderId: { type: String, ref: 'User', required: true },
  content: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  isRead: { type: Boolean, default: false },
  readBy: [{
    userId: String,
    readAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const MessageModel = mongoose.models.Message || mongoose.model("Message", messageSchema);

