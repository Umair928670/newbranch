import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import Ably from 'ably';
import fs from 'fs';
import path from 'path';

const ABLY_LOG_PATH = path.join(process.cwd(), 'ably-publishes.log');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();

    // create a test passenger
    const user = await storage.createUser({
      name: 'E2E Passenger',
      email: `e2e+${Date.now()}@example.com`,
      password: 'password',
      role: 'passenger',
      phone: null,
      clerkId: null,
      avatar: null,
      cnic: null,
      cnicStatus: 'not_uploaded',
      isAdmin: false,
    } as any);

    // pick the first available ride
    const rides = await storage.getAllRides();
    if (!rides || rides.length === 0) return res.status(400).json({ message: 'no rides' });
    const ride = rides[0];

    // create booking
    const booking = await storage.createBooking({ rideId: ride.id, passengerId: user.id, status: 'pending', seatsBooked: 1 } as any);
    await storage.updateRide(ride.id, { seatsAvailable: (ride.seatsAvailable || 0) - 1 } as any);

    // publish via Ably (and log)
    try {
      const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
      const bookChannel = ably.channels.get(`booking:${booking.id}`);
      try { fs.appendFileSync(ABLY_LOG_PATH, `e2e: publishing booking.created -> booking:${booking.id}\n`); } catch {}
      await bookChannel.publish('booking.created', booking);
      try { fs.appendFileSync(ABLY_LOG_PATH, `e2e: published booking.created -> booking:${booking.id}\n`); } catch {}

      const driverChannel = ably.channels.get(`driver:${ride.driverId}`);
      try { fs.appendFileSync(ABLY_LOG_PATH, `e2e: publishing booking.created -> driver:${ride.driverId}\n`); } catch {}
      await driverChannel.publish('booking.created', { booking, ride });
      try { fs.appendFileSync(ABLY_LOG_PATH, `e2e: published booking.created -> driver:${ride.driverId}\n`); } catch {}
    } catch (err) {
      console.error('Ably publish failed', err);
    }

    return res.json({ bookingId: booking.id, rideId: ride.id, userId: user.id });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err?.message || 'e2e failed' });
  }
}
