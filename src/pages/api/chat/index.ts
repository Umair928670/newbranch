import type { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs';
import path from 'path';

const ABLY_LOG_PATH = path.join(process.cwd(), 'ably-publishes.log');
import { connectDB } from "@/db";
import { storage } from "@/storage";
import Ably from 'ably';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();
    if (req.method === 'POST') {
      const { bookingId, senderId, content, messageType, fileUrl } = req.body as any;
      const message = await storage.createMessage({ bookingId, senderId, content, messageType, fileUrl });
      try {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
        const channel = ably.channels.get(`booking:${bookingId}`);
        console.log(`Ably: publishing message -> booking:${bookingId}`);
        try { fs.appendFileSync(ABLY_LOG_PATH, `publishing message -> booking:${bookingId}\n`); } catch {};
        await channel.publish('message', message);
        console.log(`Ably: published message -> booking:${bookingId}`);
        try { fs.appendFileSync(ABLY_LOG_PATH, `published message -> booking:${bookingId}\n`); } catch {};
      } catch (err) {
        console.error('Ably publish failed for chat message', err);
      }
      return res.status(201).json(message);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to send message' });
  }
}
