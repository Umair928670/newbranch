import { pgTable, text, varchar, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  clerkId: varchar("clerk_id"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<"passenger" | "driver" | "both">(),
  avatar: text("avatar"),
  phone: text("phone"),
  cnic: text("cnic"),
  cnicStatus: text("cnic_status").notNull().$type<"not_uploaded" | "pending" | "verified" | "rejected">().default("not_uploaded"),
  isAdmin: boolean("is_admin").default(false),

  // ✅ NEW FIELDS
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  marketingNotifications: boolean("marketing_notifications").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth schemas for signup/login
export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["passenger", "driver", "both"]),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey(),
  ownerId: varchar("owner_id").notNull(),
  model: text("model").notNull(),
  plate: text("plate").notNull(),
  color: text("color").notNull(),
  seats: integer("seats").notNull().default(4),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Rides table
export const rides = pgTable("rides", {
  id: varchar("id").primaryKey(),
  driverId: varchar("driver_id").notNull(),
  vehicleId: varchar("vehicle_id"),
  sourceLat: doublePrecision("source_lat").notNull(),
  sourceLng: doublePrecision("source_lng").notNull(),
  sourceAddress: text("source_address").notNull(),  
  destLat: doublePrecision("dest_lat").notNull(),
  destLng: doublePrecision("dest_lng").notNull(),
  destAddress: text("dest_address").notNull(),
  departureTime: timestamp("departure_time").notNull(),
  seatsTotal: integer("seats_total").notNull(),
  seatsAvailable: integer("seats_available").notNull(),
  costPerSeat: integer("cost_per_seat").notNull(),
  isActive: boolean("is_active").default(true),
  status: text("status").notNull().$type<"scheduled" | "ongoing" | "completed">().default("scheduled"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
});

export const insertRideSchema = createInsertSchema(rides)
  .omit({ id: true, status: true, currentLat: true, currentLng: true })
  .extend({
    departureTime: z.coerce.date(),
  });
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof rides.$inferSelect;

// Bookings table
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey(),
  rideId: varchar("ride_id").notNull(),
  passengerId: varchar("passenger_id").notNull(),
  status: text("status").notNull().$type<"pending" | "accepted" | "rejected" | "cancelled">(),
  seatsBooked: integer("seats_booked").notNull().default(1),
});
//review table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey(),
  rideId: varchar("ride_id").notNull(),
  reviewerId: varchar("reviewer_id").notNull(), // Passenger
  revieweeId: varchar("reviewee_id").notNull(), // Driver
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Extended types for frontend with relations
export type RideWithDriver = Ride & {
  driver: User;
  vehicle?: Vehicle;
  bookingsCount?: number;
};

export type BookingWithDetails = Booking & {
  ride: Ride;
  passenger: User;
  driver?: User;
  review?: Review;
  
  // ✅ NEW CHAT FIELDS
  unreadCount?: Record<string, number>;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: string;
    messageType: 'text' | 'image' | 'file';
  };
};
// --- MESSAGES (✅ ADDED THIS SECTION) ---
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  messageType: text("message_type").default('text'),
  fileUrl: text("file_url"),
  isRead: boolean("is_read").default(false),
  readBy: text("read_by"), // Store as JSON string since Drizzle text but used by Mongo
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true, isRead: true });
// ✅ These exports fix your error:
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
