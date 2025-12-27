import mongoose from "mongoose";

const rideSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  driverId: { type: String, ref: 'User', required: true, index: true },
  vehicleId: { type: String, ref: 'Vehicle' },
  sourceLat: { type: Number, required: true },
  sourceLng: { type: Number, required: true },
  sourceAddress: { type: String, required: true, index: true },
  destLat: { type: Number, required: true },
  destLng: { type: Number, required: true },
  destAddress: { type: String, required: true, index: true },
  departureTime: { type: Date, required: true, index: true },
  seatsTotal: { type: Number, required: true },
  seatsAvailable: { type: Number, required: true },
  costPerSeat: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["scheduled", "ongoing", "completed"], default: "scheduled" },
  currentLat: { type: Number },
  currentLng: { type: Number },
});

export const RideModel = mongoose.models.Ride || mongoose.model("Ride", rideSchema);

