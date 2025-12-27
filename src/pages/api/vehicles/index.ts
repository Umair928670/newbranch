import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import { insertVehicleSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();

    if (req.method === 'GET') {
      const ownerId = (req.query.ownerId as string) || undefined;
      if (!ownerId) return res.status(400).json({ message: 'Owner ID required' });
      const vehicles = await storage.getVehiclesByOwner(ownerId);
      return res.json(vehicles);
    }

    if (req.method === 'POST') {
      const result = insertVehicleSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      const vehicle = await storage.createVehicle(result.data as any);
      return res.json(vehicle);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Vehicles request failed' });
  }
}
