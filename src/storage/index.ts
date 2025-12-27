import type { User, InsertUser, Vehicle, InsertVehicle, Ride, InsertRide, Booking, InsertReview, InsertBooking, RideWithDriver, BookingWithDetails, Message, InsertMessage, Review } from "@shared/schema";
import { UserModel } from "../models/User";
import { VehicleModel } from "../models/Vehicle";
import { RideModel } from "../models/Ride";
import { BookingModel } from "../models/Booking";
import { ReviewModel } from "../models/Review";
import { MessageModel } from "../models/Message";
import { randomUUID } from "crypto";
import Ably from 'ably';

function stripPassword(user: any): User {
  const { password, ...safeUser } = user;
  return safeUser as User;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Vehicles
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehiclesByOwner(ownerId: string): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;
  updateRideAtomic(id: string, seatDelta: number): Promise<Ride | undefined>;

  // Rides
  getRide(id: string): Promise<Ride | undefined>;
  getRideWithDriver(id: string): Promise<RideWithDriver | undefined>;
  getAllRides(): Promise<RideWithDriver[]>;
  getRidesByDriver(driverId: string): Promise<RideWithDriver[]>;
  createRide(ride: InsertRide): Promise<Ride>;
  updateRide(id: string, data: Partial<Ride>): Promise<Ride | undefined>;
  deleteRide(id: string): Promise<boolean>;
  
  // Bookings
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingWithDetails(id: string): Promise<BookingWithDetails | undefined>;
  getAllBookings(): Promise<BookingWithDetails[]>;
  getBookingsByPassenger(passengerId: string): Promise<BookingWithDetails[]>;
  getBookingsByRide(rideId: string): Promise<BookingWithDetails[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, data: Partial<Booking>): Promise<Booking | undefined>;
  
  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByUser(userId: string): Promise<Review[]>;
  getDriverAverageRating(driverId: string): Promise<number>;

  // Chat
  createMessage(message: { bookingId: string; senderId: string; content: string; messageType?: string; fileUrl?: string }): Promise<Message>;
  getMessagesByBooking(bookingId: string): Promise<Message[]>;
  markMessagesRead(bookingId: string, userId: string): Promise<void>;

  // Stats
  getDriverStats(driverId: string): Promise<{
    totalRides: number;
    activeRides: number;
    totalBookings: number;
    totalEarnings: number;
    averageRating: number;
  }>;
}

export class MongoStorage implements IStorage {
  
  private mapDoc<T>(doc: any): T {
    if (!doc) return undefined as any;
    let obj: any;
    if (doc && typeof doc.toObject === 'function') {
      obj = doc.toObject();
    } else {
      obj = Array.isArray(doc) ? doc.map((d) => ({ ...d })) : { ...doc };
    }

    if (obj && obj._id !== undefined) {
      obj.id = obj._id;
      delete obj._id;
    }
    if (obj && obj.__v !== undefined) delete obj.__v;
    return obj as T;
  }

  private getSafeDriver(driver: User | undefined, driverId: string): User {
    if (driver) return stripPassword(driver);
    return {
      id: driverId,
      name: "Unknown Driver",
      email: "missing@data.com",
      role: "driver",
      cnicStatus: "not_uploaded",
      isAdmin: false,
      clerkId: null,
      avatar: null,
      phone: null,
      cnic: null,
      password: "" 
    } as User;
  }

  async getUser(id: string): Promise<User | undefined> {
    const doc = await UserModel.findById(id);
    return doc ? this.mapDoc<User>(doc) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ email });
    return doc ? this.mapDoc<User>(doc) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const doc = await UserModel.create({ _id: id, ...insertUser } as any);
    return this.mapDoc<User>(doc);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const doc = await UserModel.findByIdAndUpdate(id, data as any, { new: true });
    return doc ? this.mapDoc<User>(doc) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const driverRides = await RideModel.find({ driverId: id });
      await Promise.all([
        ...driverRides.map(ride => this.deleteRide(ride._id as string)),
        BookingModel.deleteMany({ passengerId: id }),
        VehicleModel.deleteMany({ ownerId: id }),
        ReviewModel.deleteMany({ reviewerId: id }),
        ReviewModel.deleteMany({ revieweeId: id }) 
      ]);
      const result = await UserModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // --- VEHICLES ---
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const doc = await VehicleModel.findById(id);
    return doc ? this.mapDoc<Vehicle>(doc) : undefined;
  }

  async getVehiclesByOwner(ownerId: string): Promise<Vehicle[]> {
    const docs = await VehicleModel.find({ ownerId });
    return docs.map(d => this.mapDoc<Vehicle>(d));
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const id = randomUUID();
    const doc = await VehicleModel.create({ _id: id, ...insertVehicle } as any);
    return this.mapDoc<Vehicle>(doc);
  }

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const doc = await VehicleModel.findByIdAndUpdate(id, data as any, { new: true });
    return doc ? this.mapDoc<Vehicle>(doc) : undefined;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const result = await VehicleModel.findByIdAndDelete(id);
    return !!result;
  }

  // --- RIDES ---
  async updateRideAtomic(id: string, seatDelta: number): Promise<Ride | undefined> {
    const query: any = { _id: id };
    if (seatDelta < 0) {
      query.seatsAvailable = { $gte: Math.abs(seatDelta) };
    }
    const doc = await RideModel.findOneAndUpdate(query, { $inc: { seatsAvailable: seatDelta } }, { new: true });
    return doc ? this.mapDoc<Ride>(doc) : undefined;
  }

  async getRide(id: string): Promise<Ride | undefined> {
    const doc = await RideModel.findById(id);
    return doc ? this.mapDoc<Ride>(doc) : undefined;
  }

  async getRideWithDriver(id: string): Promise<RideWithDriver | undefined> {
    const ride = await this.getRide(id);
    if (!ride) return undefined;
    
    const driver = await this.getUser(ride.driverId);
    const safeDriver = this.getSafeDriver(driver, ride.driverId);
    
    const vehicle = ride.vehicleId ? await this.getVehicle(ride.vehicleId) : undefined;
    const bookings = await BookingModel.find({ rideId: id });
    
    return { ...ride, driver: safeDriver, vehicle, bookingsCount: bookings.length };
  }

  // OPTIMIZED: Fetches all drivers and vehicles in parallel, avoiding N+1 queries
  async getAllRides(): Promise<RideWithDriver[]> {
    const rides = await RideModel.find({ isActive: true }).sort({ departureTime: 1 }).lean();
    if (rides.length === 0) return [];

    const driverIds = [...new Set(rides.map(r => r.driverId))];
    const vehicleIds = [...new Set(rides.map(r => r.vehicleId).filter(Boolean))];

    const [drivers, vehicles, bookingCounts] = await Promise.all([
      UserModel.find({ _id: { $in: driverIds } }).lean(),
      VehicleModel.find({ _id: { $in: vehicleIds } }).lean(),
      BookingModel.aggregate([
        { $group: { _id: "$rideId", count: { $sum: 1 } } }
      ])
    ]);

    const driverMap = new Map(drivers.map(d => [d._id.toString(), d]));
    const vehicleMap = new Map(vehicles.map(v => [v._id.toString(), v]));
    const bookingCountMap = new Map(bookingCounts.map(b => [b._id.toString(), b.count]));

    return rides.map((r: any) => {
      const ride = this.mapDoc<Ride>(r);
      const driverDoc = driverMap.get(ride.driverId);
      const safeDriver = this.getSafeDriver(driverDoc as User, ride.driverId);
      const vehicleDoc = ride.vehicleId ? vehicleMap.get(ride.vehicleId) : undefined;
      const vehicle = vehicleDoc ? this.mapDoc<Vehicle>(vehicleDoc) : undefined;
      
      return {
        ...ride,
        driver: safeDriver,
        vehicle,
        bookingsCount: bookingCountMap.get(ride.id) || 0,
      };
    });
  }

  // OPTIMIZED: Bulk fetch for specific driver
  async getRidesByDriver(driverId: string): Promise<RideWithDriver[]> {
    const rides = await RideModel.find({ driverId }).lean();
    if (rides.length === 0) return [];

    const driver = await this.getUser(driverId);
    const safeDriver = this.getSafeDriver(driver, driverId);

    const vehicleIds = [...new Set(rides.map(r => r.vehicleId).filter(Boolean))];
    const [vehicles, bookingCounts] = await Promise.all([
      VehicleModel.find({ _id: { $in: vehicleIds } }).lean(),
      BookingModel.aggregate([
        { $match: { rideId: { $in: rides.map(r => r._id) } } },
        { $group: { _id: "$rideId", count: { $sum: 1 } } }
      ])
    ]);

    const vehicleMap = new Map(vehicles.map(v => [v._id.toString(), v]));
    const bookingCountMap = new Map(bookingCounts.map(b => [b._id.toString(), b.count]));

    return rides.map((r: any) => {
      const ride = this.mapDoc<Ride>(r);
      const vehicleDoc = ride.vehicleId ? vehicleMap.get(ride.vehicleId) : undefined;
      const vehicle = vehicleDoc ? this.mapDoc<Vehicle>(vehicleDoc) : undefined;

      return {
        ...ride,
        driver: safeDriver,
        vehicle,
        bookingsCount: bookingCountMap.get(ride.id) || 0,
      };
    });
  }

  async createRide(insertRide: InsertRide): Promise<Ride> {
    const id = randomUUID();
    const doc = await RideModel.create({ _id: id, ...insertRide } as any);
    return this.mapDoc<Ride>(doc);
  }

  async updateRide(id: string, data: Partial<Ride>): Promise<Ride | undefined> {
    const doc = await RideModel.findByIdAndUpdate(id, data as any, { new: true });
    return doc ? this.mapDoc<Ride>(doc) : undefined;
  }

  async deleteRide(id: string): Promise<boolean> {
    try {
      const bookings = await BookingModel.find({ rideId: id });
      const ride = await RideModel.findById(id);

      for (const booking of bookings) {
        if (booking.status === 'pending' || booking.status === 'accepted') {
          await BookingModel.findByIdAndUpdate(booking._id, { status: 'rejected' });
          // Note: Ably notification logic omitted for brevity, ensure Ably is imported if needed
        }
      }
      const result = await RideModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("Error deleting ride:", error);
      return false;
    }
  }

  // --- BOOKINGS ---
  async getBooking(id: string): Promise<Booking | undefined> {
    const doc = await BookingModel.findById(id);
    return doc ? this.mapDoc<Booking>(doc) : undefined;
  }

  async getBookingWithDetails(id: string): Promise<BookingWithDetails | undefined> {
    const booking = await this.getBooking(id);
    if (!booking) return undefined;
    const ride = await this.getRide(booking.rideId);
    if (!ride) return undefined;
    const passenger = await this.getUser(booking.passengerId);
    const safePassenger = this.getSafeDriver(passenger, booking.passengerId);
    const driver = await this.getUser(ride.driverId);
    const safeDriver = driver ? stripPassword(driver) : undefined;
    return { ...booking, ride, passenger: safePassenger, driver: safeDriver };
  }

  // OPTIMIZED: Fetches all bookings and their reviews in bulk
  async getAllBookings(): Promise<BookingWithDetails[]> {
    const bookings = await BookingModel.find()
      .populate('passengerId')
      .populate({ path: 'rideId', populate: { path: 'driverId' } })
      .sort({ _id: -1 })
      .lean();

    if (bookings.length === 0) return [];

    // Collect all reviewer IDs to fetch reviews in ONE query
    const reviewQueries = bookings
      .filter((b: any) => b.rideId && b.passengerId)
      .map((b: any) => ({ 
        rideId: b.rideId._id || b.rideId, 
        reviewerId: b.passengerId._id || b.passengerId 
      }));

    let reviews: any[] = [];
    if (reviewQueries.length > 0) {
      // Find reviews that match any of our booking pairs
      // Note: $or query is still faster than N separate DB calls
      const orConditions = reviewQueries.map(q => ({
        rideId: q.rideId.toString(),
        reviewerId: q.reviewerId.toString()
      }));
      reviews = await ReviewModel.find({ $or: orConditions }).lean();
    }

    const reviewMap = new Map();
    reviews.forEach((r: any) => {
      const key = `${r.rideId}-${r.reviewerId}`;
      reviewMap.set(key, r);
    });

    return bookings.map((doc: any) => {
      const booking = this.mapDoc<Booking>(doc);
      const rideId = (doc.rideId?._id || doc.rideId)?.toString();
      const reviewerId = (doc.passengerId?._id || doc.passengerId)?.toString();
      
      let review = null;
      if (rideId && reviewerId) {
        const reviewDoc = reviewMap.get(`${rideId}-${reviewerId}`);
        if (reviewDoc) review = this.mapDoc<Review>(reviewDoc);
      }
      return { ...booking, review };
    }) as BookingWithDetails[];
  }

  async getBookingsByPassenger(passengerId: string): Promise<BookingWithDetails[]> {
    const bookings = await BookingModel.find({ passengerId });
    const results: BookingWithDetails[] = [];
    for (const b of bookings) {
      const details = await this.getBookingWithDetails(b._id as string);
      if (details) results.push(details);
    }
    return results;
  }

  async getBookingsByRide(rideId: string): Promise<BookingWithDetails[]> {
    const bookings = await BookingModel.find({ rideId });
    const results: BookingWithDetails[] = [];
    for (const b of bookings) {
      const details = await this.getBookingWithDetails(b._id as string);
      if (details) results.push(details);
    }
    return results;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const doc = await BookingModel.create({ _id: id, ...insertBooking } as any);
    return this.mapDoc<Booking>(doc);
  }

  async updateBooking(id: string, data: Partial<Booking>): Promise<Booking | undefined> {
    const existingBooking = await this.getBooking(id);
    if (!existingBooking) return undefined;

    const doc = await BookingModel.findByIdAndUpdate(id, data as any, { new: true });
    const booking = doc ? this.mapDoc<Booking>(doc) : undefined;

    if (booking) {
        const ride = await this.getRide(booking.rideId);
        if (ride) {
            if (data.status === "cancelled" && existingBooking.status === "accepted") {
                await this.updateRide(ride.id, { seatsAvailable: ride.seatsAvailable + booking.seatsBooked });
            }
        }
    }
    return booking;
  }

  // --- REVIEWS & CHAT & STATS (Unchanged) ---
  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const doc = await ReviewModel.create({ _id: id, ...insertReview } as any);
    return this.mapDoc<Review>(doc);
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    const docs = await ReviewModel.find({ revieweeId: userId }).sort({ createdAt: -1 });
    return docs.map(d => this.mapDoc<Review>(d));
  }

  async getDriverAverageRating(driverId: string): Promise<number> {
    const reviews = await ReviewModel.find({ revieweeId: driverId });
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    return Number((sum / reviews.length).toFixed(1));
  }

  async createMessage(data: { bookingId: string; senderId: string; content: string; messageType?: string; fileUrl?: string }): Promise<Message> {
    const id = randomUUID();
    const messageDoc = await MessageModel.create({
      _id: id, ...data, createdAt: new Date(), messageType: data.messageType || 'text', isRead: false
    });
    const message = this.mapDoc<Message>(messageDoc);

    const booking = await BookingModel.findById(data.bookingId).populate('rideId');
    if (booking) {
      const ride = booking.rideId as any; 
      const receiverId = data.senderId === ride.driverId ? booking.passengerId : ride.driverId;
      await BookingModel.findByIdAndUpdate(data.bookingId, {
        lastMessage: {
          content: data.messageType === 'image' ? '📷 Image' : data.content,
          senderId: data.senderId,
          timestamp: new Date(),
          messageType: data.messageType || 'text'
        },
        $inc: { [`unreadCount.${receiverId}`]: 1 }
      });
    }
    return message;
  }

  async getMessagesByBooking(bookingId: string): Promise<Message[]> {
    const docs = await MessageModel.find({ bookingId }).sort({ createdAt: 1 });
    return docs.map(d => this.mapDoc<Message>(d));
  }

  async markMessagesRead(bookingId: string, userId: string): Promise<void> {
    await MessageModel.updateMany(
      { bookingId, senderId: { $ne: userId } },
      { $addToSet: { readBy: { userId, readAt: new Date() } }, isRead: true } 
    );
    await BookingModel.findByIdAndUpdate(bookingId, { [`unreadCount.${userId}`]: 0 });
  }

  async getDriverStats(driverId: string): Promise<{
    totalRides: number; activeRides: number; totalBookings: number; totalEarnings: number; averageRating: number;
  }> {
    const rides = await RideModel.find({ driverId });
    const activeRides = rides.filter(r => r.isActive).length;
    let totalBookings = 0;
    let totalEarnings = 0;

    // Consider optimizing this loop as well if stats page is slow
    for (const ride of rides) {
       const bookings = await BookingModel.find({ rideId: ride._id, status: 'accepted' });
       totalBookings += bookings.length;
       const seats = bookings.reduce((sum, b) => sum + (b.seatsBooked || 1), 0);
       totalEarnings += seats * ride.costPerSeat;
    }

    const averageRating = await this.getDriverAverageRating(driverId);
    return { totalRides: rides.length, activeRides, totalBookings, totalEarnings, averageRating };
  }
}

export const storage = new MongoStorage();