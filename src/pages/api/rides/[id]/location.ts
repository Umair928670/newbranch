import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ message: 'Method not allowed' });
  const { id } = req.query as { id: string };

  try {
    await connectDB();
    const { lat, lng } = req.body as any;
    const ride = await storage.updateRide(id, { currentLat: lat, currentLng: lng } as any);
    return res.json(ride);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Update failed' });
  }
}
