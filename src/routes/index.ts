import "dotenv/config";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { insertVehicleSchema, insertRideSchema, insertBookingSchema, signupSchema, loginSchema, insertReviewSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Ably from 'ably';
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ably = new Ably.Rest(process.env.ABLY_API_KEY || "Missing_Key");

const uploadStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'unipool', 
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
  } as any, 
});

const upload = multer({ storage: uploadStorage as any });

function stripPassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- AUTH ROUTES ---
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const result = signupSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });

      const { email, password, name, role, phone } = result.data;
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const user = await storage.createUser({
        name, email, password, role: role || "passenger", phone: phone || null,
        clerkId: null, avatar: null, cnic: null, cnicStatus: "not_uploaded", isAdmin: false,
      });

      res.json(stripPassword(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });

      const { email, password } = result.data;
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) return res.status(401).json({ message: "Invalid credentials" });

      res.json(stripPassword(user));
    } catch (error: any) {
      res.status(401).json({ message: "Login failed" });
    }
  });

  // --- USER ROUTES ---
  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(stripPassword(user));
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(stripPassword(user));
    } catch (error: any) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.post("/api/users/:id/avatar", upload.single("avatar") as any, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      
      const avatarUrl = req.file.path; 
      const user = await storage.updateUser(req.params.id, { avatar: avatarUrl });
      
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(stripPassword(user));
    } catch (error: any) {
      console.error("Avatar Upload Error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.post("/api/users/:id/cnic", upload.single("cnic") as any, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const cnicUrl = req.file.path;
      const user = await storage.updateUser(req.params.id, { 
        cnic: cnicUrl,
        cnicStatus: "pending" 
      });

      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(stripPassword(user));
    } catch (error: any) {
      console.error("CNIC Upload Error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  // --- VEHICLE ROUTES ---
  app.get("/api/vehicles", async (req, res) => {
    const ownerId = req.query.ownerId as string;
    if (!ownerId) return res.status(400).json({ message: "Owner ID required" });
    const vehicles = await storage.getVehiclesByOwner(ownerId);
    res.json(vehicles);
  });

  app.post("/api/vehicles", async (req, res) => {
    try {
      const result = insertVehicleSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      const vehicle = await storage.createVehicle(result.data);
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create vehicle" });
    }
  });

  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, req.body);
      if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: "Update failed" });
    }
  });

  // --- RIDE ROUTES ---
  app.get("/api/rides", async (req, res) => {
    const driverId = req.query.driverId as string;
    const rides = driverId ? await storage.getRidesByDriver(driverId) : await storage.getAllRides();
    res.json(rides);
  });

  app.post("/api/rides", async (req, res) => {
    try {
      const result = insertRideSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      const ride = await storage.createRide(result.data);
      res.json(ride);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create ride" });
    }
  });

  app.patch("/api/rides/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const updateData: any = { status };
      if (status === 'completed') updateData.isActive = false;
      const ride = await storage.updateRide(req.params.id, updateData);
      res.json(ride);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update status" });
    }
  });

  app.patch("/api/rides/:id/location", async (req, res) => {
    try {
      const { lat, lng, userId } = req.body;
      const ride = await storage.getRide(req.params.id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      if (ride.driverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updatedRide = await storage.updateRide(req.params.id, { currentLat: lat, currentLng: lng });
      
      // Notify via Ably
      try {
        const channel = ably.channels.get(`ride:${req.params.id}`);
        await channel.publish('location.update', { lat, lng });
      } catch (e) {}

      res.json(updatedRide);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/rides/:id", async (req, res) => {
    const deleted = await storage.deleteRide(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Ride not found" });
    res.json({ success: true });
  });

  // --- BOOKING ROUTES ---
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const createBookingSchema = z.object({
        rideId: z.string(),
        passengerId: z.string(),
        seatsBooked: z.number().min(1).default(1),
      });

      const result = createBookingSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      
      const { rideId, passengerId, seatsBooked } = result.data;

      // ATOMIC UPDATE: Only decrement if enough seats are available
      const ride = await storage.updateRideAtomic(rideId, -seatsBooked);
      
      if (!ride) {
        return res.status(400).json({ message: "Ride not found or not enough seats available" });
      }

      const booking = await storage.createBooking({ rideId, passengerId, status: "pending", seatsBooked });

      // Notify driver via Ably
      try {
        const channel = ably.channels.get(`driver:${ride.driverId}`);
        await channel.publish('booking.created', { booking, ride });
      } catch (err) {
        console.error("Ably notification failed", err);
      }

      res.json(booking);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ message: "Booking failed" });
    }
  });

  app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const { status } = req.body;
      const userId = req.headers['x-user-id'] as string;
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const ride = await storage.getRide(booking.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      // Only driver of the ride can accept/reject
      if (status === 'accepted' || status === 'rejected') {
        if (ride.driverId !== userId) {
            return res.status(403).json({ message: "Only drivers can accept/reject bookings" });
        }
      }

      // Only passenger who booked can cancel
      if (status === 'cancelled') {
          if (booking.passengerId !== userId) {
              return res.status(403).json({ message: "Only passengers can cancel their own bookings" });
          }
      }

      const updatedBooking = await storage.updateBooking(req.params.id, { status });
      
      // Notify via Ably
      try {
        const channel = ably.channels.get(`passenger:${booking.passengerId}`);
        await channel.publish('booking.updated', { booking: updatedBooking });
        
        const driverChannel = ably.channels.get(`driver:${ride.driverId}`);
        await driverChannel.publish('booking.updated', { booking: updatedBooking });
      } catch (e) {}

      res.json(updatedBooking);
    } catch (err) {
      res.status(400).json({ message: "Failed to update booking" });
    }
  });

  // --- REVIEW ROUTES ---
  app.post("/api/reviews", async (req, res) => {
    try {
      const result = insertReviewSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });
      const review = await storage.createReview(result.data);
      res.json(review);
    } catch (error: any) {
      res.status(400).json({ message: "Review failed" });
    }
  });

  app.get("/api/users/:id/reviews", async (req, res) => {
    const reviews = await storage.getReviewsByUser(req.params.id);
    res.json(reviews);
  });

  app.get("/api/stats/:userId", async (req, res) => {
    const stats = await storage.getDriverStats(req.params.userId);
    res.json(stats);
  });

  app.post("/api/users/:id/password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser(req.params.id);

      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.password !== currentPassword) {
        return res.status(400).json({ message: "Incorrect current password" });
      }

      await storage.updateUser(user.id, { password: newPassword });
      
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or already deleted" });
      }
      
      res.json({ success: true, message: "Account permanently deleted" });
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get('/api/auth/ably', async (req, res) => {
    const clientId = req.query.userId as string || "anonymous";
    try {
      const tokenRequestData = await ably.auth.createTokenRequest({ clientId });
      res.json(tokenRequestData);
    } catch (err) {
      console.error("Ably Auth Error:", err);
      res.status(500).send("Error generating Ably token");
    }
  });

  app.get('/api/chat/:bookingId', async (req, res) => {
    try {
      const messages = await storage.getMessagesByBooking(req.params.bookingId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { bookingId, senderId, content, messageType, fileUrl } = req.body;
      
      const message = await storage.createMessage({ 
        bookingId, 
        senderId, 
        content, 
        messageType, 
        fileUrl 
      });
      
      const channel = ably.channels.get(`booking:${bookingId}`);
      await channel.publish('message', message);

      res.status(201).json(message);
    } catch (error) {
      console.error("Send Error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post('/api/chat/read', async (req, res) => {
    try {
      const { bookingId, userId } = req.body;
      await storage.markMessagesRead(bookingId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  return httpServer;
}

