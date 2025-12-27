import type { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs';
import path from 'path';

const ABLY_LOG_PATH = path.join(process.cwd(), 'ably-publishes.log');
import { connectDB } from "@/db";
import { storage } from "@/storage";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import Ably from 'ably';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();

    if (req.method === 'GET') {
      const bookings = await storage.getAllBookings();
      return res.json(bookings);
    }

    if (req.method === 'POST') {
      const createBookingSchema = z.object({
        rideId: z.string(),
        passengerId: z.string(),
        seatsBooked: z.number().min(1).default(1),
      });

      const result = createBookingSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });

      const { rideId, passengerId, seatsBooked } = result.data;
      const ride = await storage.getRide(rideId);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (ride.seatsAvailable < seatsBooked) return res.status(400).json({ message: `Only ${ride.seatsAvailable} seats available` });

      const booking = await storage.createBooking({ rideId, passengerId, status: 'pending', seatsBooked } as any);
    
      try {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
        // publish to booking-specific channel
        const bookChannel = ably.channels.get(`booking:${booking.id}`);
        console.log(`Ably: publishing booking.created -> booking:${booking.id}`);
        try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.created -> booking:${booking.id}\n`); } catch {};
        await bookChannel.publish('booking.created', booking);
        console.log(`Ably: published booking.created -> booking:${booking.id}`);
        try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.created -> booking:${booking.id}\n`); } catch {};

        // notify the driver for this ride
        const ride = await storage.getRide(rideId);
        if (ride) {
          const driverChannel = ably.channels.get(`driver:${ride.driverId}`);
          console.log(`Ably: publishing booking.created -> driver:${ride.driverId}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.created -> driver:${ride.driverId}\n`); } catch {};
          await driverChannel.publish('booking.created', { booking, ride });
          console.log(`Ably: published booking.created -> driver:${ride.driverId}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.created -> driver:${ride.driverId}\n`); } catch {};
        }
      } catch (err) {
        console.error('Ably publish failed for booking.created', err);
      }

      return res.json(booking);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Booking failed' });
  }
}
