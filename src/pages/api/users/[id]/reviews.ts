import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  try {
    await connectDB();
    if (req.method === 'GET') {
      const reviews = await storage.getReviewsByUser(id);
      return res.json(reviews);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to load reviews' });
  }
}
