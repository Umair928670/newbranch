import type { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const ABLY_LOG_PATH = path.join(process.cwd(), 'ably-publishes.log');
import { connectDB } from "@/db";
import { storage } from "@/storage";
import Ably from 'ably';
import { BookingModel } from '@/models/Booking';
import { RideModel } from '@/models/Ride';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  try {
    await connectDB();

    if (req.method === 'GET') {
      const bookingDetails = await storage.getBookingWithDetails(id);
      if (!bookingDetails) return res.status(404).json({ message: 'Booking not found' });
      return res.json(bookingDetails);
    }

    if (req.method === 'PATCH') {
      // Require caller identity in header (simple auth for server-to-server/testing).
      const userId = (req.headers['x-user-id'] || req.headers['x_user_id']) as string | undefined;
      if (!userId) return res.status(401).json({ message: 'Missing x-user-id header for auth' });

      const { status } = req.body as any;

      // Handle atomic status transitions (accept/reject/cancel) inside a transaction
      if (status === 'accepted' || status === 'rejected' || status === 'cancelled') {
        const session = await mongoose.startSession();
        let updatedBooking: any = null;
        try {
          await session.withTransaction(async () => {
            const bookingDoc = await BookingModel.findById(id).session(session);
            if (!bookingDoc) throw { code: 404, message: 'Booking not found' };

            const rideDoc = await RideModel.findById(bookingDoc.rideId).session(session);
            if (!rideDoc) throw { code: 404, message: 'Ride not found' };

            // Authorization:
            // - accept/reject: only the ride's driver
            // - cancel: driver OR the passenger who owns the booking
            const isDriver = String(rideDoc.driverId) === String(userId);
            const isPassenger = String(bookingDoc.passengerId) === String(userId);

            if (status === 'accepted' || status === 'rejected') {
              if (!isDriver) throw { code: 401, message: 'Not authorized' };
            } else if (status === 'cancelled') {
              if (!isDriver && !isPassenger) throw { code: 401, message: 'Not authorized' };
            }

            if (status === 'accepted') {

              if (bookingDoc.status !== 'pending') throw { code: 409, message: 'Booking not pending' };
              const seatsNeeded = bookingDoc.seatsBooked || 1;
              if ((rideDoc.seatsAvailable || 0) < seatsNeeded) throw { code: 400, message: 'Not enough seats' };

              rideDoc.seatsAvailable = (rideDoc.seatsAvailable || 0) - seatsNeeded;
              await rideDoc.save({session});
              
              bookingDoc.status = 'accepted';
              await bookingDoc.save({ session });

            } 
            else if (status === 'rejected'){
              bookingDoc.status = 'rejected';
              await bookingDoc.save({ session});
            }
            else if (status === 'cancelled'){
              if(bookingDoc.status === 'accepted'){
                rideDoc.seatsAvailable = (rideDoc.seatsAvailable || 0) + (bookingDoc.seatsBooked || 1);
                await rideDoc.save({session});
              }

              bookingDoc.status = 'cancelled';
              await bookingDoc.save({session}); 
            }

            updatedBooking = bookingDoc.toObject();

            updatedBooking.id = updatedBooking._id.toString();
          });
        } finally {
          session.endSession();
        }

        // Publish via Ably
        try {
          const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
          const bookChannel = ably.channels.get(`booking:${updatedBooking.id}`);
          console.log(`Ably: publishing booking.updated -> booking:${updatedBooking.id}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> booking:${updatedBooking.id}\n`); } catch {};
          await bookChannel.publish('booking.updated', updatedBooking);
          console.log(`Ably: published booking.updated -> booking:${updatedBooking.id}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> booking:${updatedBooking.id}\n`); } catch {};

          const ride = await storage.getRide(updatedBooking.rideId as any);
          if (ride) {
            const driverChannel = ably.channels.get(`driver:${ride.driverId}`);
            console.log(`Ably: publishing booking.updated -> driver:${ride.driverId}`);
            try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> driver:${ride.driverId}\n`); } catch {};
            await driverChannel.publish('booking.updated', { booking: updatedBooking, ride });
            console.log(`Ably: published booking.updated -> driver:${ride.driverId}`);
            try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> driver:${ride.driverId}\n`); } catch {};

            // Also notify passenger
            const passengerChannel = ably.channels.get(`passenger:${updatedBooking.passengerId}`);
            console.log(`Ably: publishing booking.updated -> passenger:${updatedBooking.passengerId}`);
            try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> passenger:${updatedBooking.passengerId}\n`); } catch {};
            await passengerChannel.publish('booking.updated', { booking: updatedBooking, ride });
            console.log(`Ably: published booking.updated -> passenger:${updatedBooking.passengerId}`);
            try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> passenger:${updatedBooking.passengerId}\n`); } catch {};
          }
        } catch (err) {
          console.error('Ably publish failed for booking.updated', err);
        }

        return res.json(updatedBooking);
      }

      // Fallback: other updates use storage
      const booking = await storage.updateBooking(id, req.body as any);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });

      try {
        const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
        const bookChannel = ably.channels.get(`booking:${booking.id}`);
        try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> booking:${booking.id}\n`); } catch {};
        await bookChannel.publish('booking.updated', booking);
        try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> booking:${booking.id}\n`); } catch {};

        const ride = await storage.getRide(booking.rideId as any);
        if (ride) {
          const driverChannel = ably.channels.get(`driver:${ride.driverId}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> driver:${ride.driverId}\n`); } catch {};
          await driverChannel.publish('booking.updated', { booking, ride });
          try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> driver:${ride.driverId}\n`); } catch {};

          // Also notify passenger
          const passengerChannel = ably.channels.get(`passenger:${booking.passengerId}`);
          try { fs.appendFileSync(ABLY_LOG_PATH, `publishing booking.updated -> passenger:${booking.passengerId}\n`); } catch {};
          await passengerChannel.publish('booking.updated', { booking, ride });
          try { fs.appendFileSync(ABLY_LOG_PATH, `published booking.updated -> passenger:${booking.passengerId}\n`); } catch {};
        }
      } catch (err) {
        console.warn('Ably publish failed for booking.updated', err);
      }

      return res.json(booking);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    if (error && error.code) return res.status(error.code).json({ message: error.message || 'Error' });
    return res.status(500).json({ message: error?.message || 'Booking request failed' });
  }
}
