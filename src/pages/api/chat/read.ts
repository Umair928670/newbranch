import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await connectDB();
    const { bookingId, userId } = req.body as any;
    await storage.markMessagesRead(bookingId, userId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to mark read' });
  }
}
