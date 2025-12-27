import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ message: 'Method not allowed' });
  const { id } = req.query as { id: string };

  try {
    await connectDB();
    const { status } = req.body as any;
    const updateData: any = { status };
    if (status === 'completed') updateData.isActive = false;
    const ride = await storage.updateRide(id, updateData);
    return res.json(ride);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Update failed' });
  }
}
