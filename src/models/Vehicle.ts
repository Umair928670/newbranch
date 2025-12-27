import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  ownerId: { type: String, ref: 'User', required: true },
  model: { type: String, required: true },
  plate: { type: String, required: true },
  color: { type: String, required: true },
  seats: { type: Number, default: 4 }
});

export const VehicleModel = mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);

