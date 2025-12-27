import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { bookingId } = req.query as { bookingId: string };
  try {
    await connectDB();
    if (req.method === 'GET') {
      const messages = await storage.getMessagesByBooking(bookingId);
      return res.json(messages);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to load messages' });
  }
}
