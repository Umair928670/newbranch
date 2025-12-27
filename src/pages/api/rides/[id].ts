import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  try {
    await connectDB();

    if (req.method === 'DELETE') {
      const deleted = await storage.deleteRide(id);
      if (!deleted) return res.status(404).json({ message: 'Ride not found' });
      return res.json({ success: true });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Ride request failed' });
  }
}
