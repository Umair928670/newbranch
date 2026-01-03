import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import { insertRideSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import Ably from 'ably';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();

    if (req.method === 'GET') {
      const driverId = req.query.driverId as string | undefined;
      const rides = driverId ? await storage.getRidesByDriver(driverId) : await storage.getAllRides();
      return res.json(rides);
    }

    if (req.method === 'POST') {
      const result = insertRideSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      const ride = await storage.createRide(result.data as any);

      // Publish ride creation
      try {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
        const rideChannel = ably.channels.get(`ride:${ride.id}`);
        await rideChannel.publish('ride.created', ride);
      } catch (err) {
        console.error('Ably publish failed for ride.created', err);
      }

      return res.json(ride);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Rides request failed' });
  }
}
