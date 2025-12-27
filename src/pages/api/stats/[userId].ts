import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  try {
    await connectDB();
    const stats = await storage.getDriverStats(userId);
    return res.json(stats);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to get stats' });
  }
}
