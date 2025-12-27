"use client";

import { useState,useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Ably from 'ably';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { RoleToggle } from "@/components/role-toggle";
import { RideCard } from "@/components/ride-card";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { RideCardSkeleton, StatCardSkeleton } from "@/components/loading-skeleton";
import { MapComponent } from "@/components/map-component";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RideWithDriver, Booking } from "@shared/schema";
import {
  Search,
  MapPin,
  Map as MapIcon,
  Plus,
  Car,
  Users,
  Banknote,
  TrendingUp,
  Clock,
  Calendar,
  ShieldCheck,
  Star,
  Loader2,
  ArrowRight,MessageCircle,
  Check,
  BellRing
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // ✅ NEW: Separate states for Pickup and Dropoff search
  const [pickupSearch, setPickupSearch] = useState("");
  const [dropoffSearch, setDropoffSearch] = useState("");
  
  const [selectedRide, setSelectedRide] = useState<RideWithDriver | null>(null);

  // --- QUERIES ---
  const { data: rides, isLoading: ridesLoading } = useQuery<RideWithDriver[]>({
    queryKey: [activeRole === 'driver' ? `/api/rides?driverId=${user?.id}` : "/api/rides"],
  });

  const { data: bookings, refetch: reloadBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    refetchInterval: activeRole === 'driver' ? 3000 : false,
  });

  // Ably realtime subscription for driver notifications
  useEffect(() => {
    if (activeRole !== 'driver' || !user) return;

    // Reuse a single Ably client per window to avoid create/close races that throw
    const globalAny: any = (typeof window !== 'undefined' ? window : {});
    if (!globalAny.__UNIPOOL_ABLY_CLIENT) {
      try {
        globalAny.__UNIPOOL_ABLY_CLIENT = new Ably.Realtime({ authUrl: `/api/auth/ably?userId=${user.id}` });
      } catch (err) {
        console.warn('Ably init failed', err);
        return;
      }
    }
    const client: Ably.Realtime = globalAny.__UNIPOOL_ABLY_CLIENT as Ably.Realtime;
    const driverChannel = client.channels.get(`driver:${user.id}`);

    const handler = (msg: any) => {
      // On booking.created or booking.updated, refresh bookings and rides
      if (msg.name && (msg.name === 'booking.created' || msg.name === 'booking.updated')) {
        reloadBookings();
        queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
        toast({ title: 'New ride request', description: 'A passenger requested to join your ride.' });
      }
    };

    driverChannel.subscribe(handler);

    return () => {
      try {
        driverChannel.unsubscribe(handler as any);
      } catch (e) {
        console.warn('Ably unsubscribe error', e);
      }

      try {
        // Do not close the global client here — keep a single client for the app lifecycle.
        // Closing frequently can race with other mounts and cause "Connection closed" errors.
        // If you need to fully cleanup (e.g., on logout), explicitly call `window.__UNIPOOL_ABLY_CLIENT.close()` elsewhere.
      } catch (e) {
        console.warn('Ably cleanup error', e);
      }
    };
  }, [activeRole, user]);

  // State for Live Tracking
  const [trackingRide, setTrackingRide] = useState<RideWithDriver | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRides: number;
    totalBookings: number;
    totalEarnings: number;
    activeRides: number;
  }>({
    queryKey: ["/api/stats", user?.id],
    enabled: !!user?.id,
  });

  // --- MUTATIONS ---
  const createBookingMutation = useMutation({
    mutationFn: async ({ rideId, seats }: { rideId: string, seats: number }) => {
      return apiRequest("POST", "/api/bookings", { 
        rideId, 
        passengerId: user?.id, 
        seatsBooked: seats 
      });
    },
    onSuccess: () => {
      toast({ title: "Request Sent", description: "The driver has been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      setSelectedRide(null);
    },
    onError: (error: any) => {
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
    }
  });

  const updateRideStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await apiRequest("PATCH", `/api/rides/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
      toast({ title: "Ride Status Updated" });
    },
  });

  const handleBookingAction = async (bookingId: string, action: "accepted" | "rejected") => {
    try {
      // include driver identity header so server can authorize
      await apiRequest("PATCH", `/api/bookings/${bookingId}`, { status: action }, { 'x-user-id': user?.id || '' });
      toast({ title: `Request ${action}` });
      reloadBookings();
      queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
    } catch (error) {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const getId = (item: any) => {
    if (!item) return null;
    return typeof item === 'object' ? item._id : item;
  };

  const getMyBookingStatus = (rideId: string) => {
    const myBooking = bookings?.find(b => {
      const bRideId = getId(b.rideId);
      const bPassengerId = getId(b.passengerId);
      return bRideId === rideId && bPassengerId === user?.id && b.status !== 'cancelled';
    });
    return myBooking?.status;
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // ✅ UPDATED FILTER LOGIC: Matches BOTH Pickup AND Dropoff
  const filteredRides = rides?.filter((ride) => {
    const matchPickup = !pickupSearch || ride.sourceAddress.toLowerCase().includes(pickupSearch.toLowerCase());
    const matchDropoff = !dropoffSearch || ride.destAddress.toLowerCase().includes(dropoffSearch.toLowerCase());
    
    // Only show ride if it matches BOTH criteria
    return matchPickup && matchDropoff;
  });

  // --- DRIVER VIEW ---
  if (activeRole === "driver") {
    // 1. Identify the LIVE ride (Started)
    const ongoingRide = rides?.find(r => r.status === 'ongoing');

    // 2. Identify Pending Requests for Scheduled (Non-Active) rides
    const scheduledRequests = bookings?.filter(b => {
        const bRideId = getId(b.rideId);
        const ride = rides?.find(r => r.id === bRideId);

        return b.status === 'pending' && 
        ride && 
        ride.status !== 'completed' && 
        bRideId !== ongoingRide?.id;
    }) || [];

    // 3. Stats for Ongoing Ride
    const activeRideBookings = bookings?.filter(b => getId(b.rideId) === ongoingRide?.id) || [];
    const liveRequests = activeRideBookings.filter(b => b.status === 'pending');
    const acceptedPassengers = activeRideBookings.filter(b => b.status === 'accepted');
    const totalSeats = ongoingRide?.seatsTotal || 0;
    const seatsBooked = totalSeats - (ongoingRide?.seatsAvailable || 0);

    return (
      <div className="min-h-screen bg-background">
        <div className="container px-4 py-8 max-w-6xl">
          
          {/* HEADER */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Driver Dashboard</h1>
              <p className="text-muted-foreground">Manage rides & track earnings</p>
            </div>
            <div className="flex items-center gap-3">
              <RoleToggle />
              <Link href="/post-ride">
                <Button className="gap-2"><Plus className="h-4 w-4" /> Post New Ride</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statsLoading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard title="Total Rides" value={stats?.totalRides || 0} icon={Car} />
                <StatCard title="Active Rides" value={stats?.activeRides || 0} icon={TrendingUp} />
                <StatCard title="Total Bookings" value={stats?.totalBookings || 0} icon={Users} />
                <StatCard title="Earnings" value={`Rs. ${stats?.totalEarnings || 0}`} icon={Banknote} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* --- SECTION 1: NOTIFICATIONS (Scheduled Rides) --- */}
              {scheduledRequests.length > 0 && (
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-5 w-5 text-blue-600 animate-pulse" />
                      <CardTitle className="text-lg text-blue-900">Ride Requests</CardTitle>
                    </div>
                    <CardDescription>Passengers requesting to join your scheduled rides.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    {scheduledRequests.map((booking: any) => {
                      const rideInfo = rides?.find(r => r.id === getId(booking.rideId));
                      return (
                        <div key={booking._id || booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white border rounded-lg shadow-sm">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border">
                              <AvatarImage src={booking.passengerId?.avatar} />
                              <AvatarFallback>{booking.passengerId?.name?.[0] || "P"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-sm">{booking.passengerId?.name || "Passenger"}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="font-medium text-blue-700">To: {rideInfo?.destAddress || "Unknown"}</span>
                                <span>•</span>
                                <span>{rideInfo ? format(new Date(rideInfo.departureTime), "MMM d, h:mm a") : ""}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            {booking.status === 'accepted' ? (
                               <Link href={`/chat/${booking._id || booking.id}`} className="flex-1 sm:flex-none">
                                 <Button size="sm" variant="secondary" className="w-full sm:w-auto gap-2">
                                   <MessageCircle className="h-4 w-4" /> Chat
                                 </Button>
                               </Link>
                            ) : booking.status === 'pending' ? (
                              <>
                                <Button size="sm" className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 h-8" onClick={() => handleBookingAction(booking._id || booking.id, 'accepted')}>Accept</Button>
                                <Button size="sm" variant="outline" className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 h-8" onClick={() => handleBookingAction(booking._id || booking.id, 'rejected')}>Decline</Button>
                              </>
                            ) : (
                              <Badge variant="outline">{booking.status}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* --- SECTION 2: LIVE RIDE --- */}
              {ongoingRide ? (
                <Card className="border-primary/50 shadow-md">
                  <CardHeader className="bg-primary/5 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="default" className="mb-2 bg-red-600 hover:bg-red-600 animate-pulse">
                          🔴 LIVE NOW
                        </Badge>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {ongoingRide.sourceAddress} <ArrowRight className="h-4 w-4" /> {ongoingRide.destAddress}
                        </CardTitle>
                        <CardDescription>
                          Started at: {new Date(ongoingRide.departureTime).toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      <Button variant="destructive" onClick={() => updateRideStatusMutation.mutate({ id: ongoingRide.id, status: 'completed' })}>
                        Finish Ride
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-6 grid md:grid-cols-2 gap-8">
                    {/* Seat Stats */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Capacity</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/50 rounded-lg text-center border">
                          <div className="text-2xl font-bold">{seatsBooked}</div>
                          <div className="text-xs text-muted-foreground">Booked</div>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
                          <div className="text-2xl font-bold text-primary">{ongoingRide.seatsAvailable}</div>
                          <div className="text-xs text-muted-foreground">Remaining</div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mt-4">Current Passengers</h3>
                      {acceptedPassengers.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No passengers currently on board.</p>
                      ) : (
                        <div className="space-y-2">
                          {acceptedPassengers.map((booking: any) => (
                            <div key={booking._id || booking.id} className="flex items-center gap-3 p-2 border rounded-md bg-card justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={booking.passengerId?.avatar} />
                                  <AvatarFallback>{booking.passengerId?.name?.[0] || "P"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{booking.passengerId?.name}</p>
                                  <Badge variant="secondary" className="text-[10px]">{booking.seatsBooked} Seat(s)</Badge>
                                </div>
                              </div>
                              
                              {/* ✅ CHAT BUTTON FOR LIVE PASSENGERS */}
                              <Link href={`/chat/${booking._id || booking.id}`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* LIVE REQUESTS */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Live Requests</h3>
                        {liveRequests.length > 0 && <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />}
                      </div>
                      
                      {liveRequests.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg text-muted-foreground">
                          <Users className="h-6 w-6 mb-2 opacity-20" />
                          <p className="text-sm">No new requests for this ride.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {liveRequests.map((booking: any) => (
                            <div key={booking._id || booking.id} className="p-3 border border-yellow-200 bg-yellow-50/30 rounded-lg shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>Req</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm">{booking.passengerId?.name || "User"}</p>
                                    <p className="text-xs text-muted-foreground">Nearby • Wants {booking.seatsBooked} seat(s)</p>
                                  </div>
                                </div>
                                <Badge className="bg-yellow-500 hover:bg-yellow-600">New</Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => handleBookingAction(booking._id || booking.id, 'accepted')}>
                                  Accept
                                </Button>
                                <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs" onClick={() => handleBookingAction(booking._id || booking.id, 'rejected')}>
                                  Decline
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // SECTION 3: MY RIDES LIST
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>My Scheduled Rides</CardTitle>
                    <Link href="/my-rides"><Button variant="outline" size="sm">View All</Button></Link>
                  </CardHeader>
                  <CardContent>
                    {filteredRides && filteredRides.filter(r => r.driverId === user?.id && r.status === 'scheduled').length > 0 ? (
                      <div className="space-y-4">
                        {filteredRides.filter((r) => r.driverId === user?.id && r.status === 'scheduled').slice(0, 3).map((ride) => (
                          <div key={ride.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {ride.sourceAddress} <ArrowRight className="h-3 w-3" /> {ride.destAddress}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {format(new Date(ride.departureTime), "MMM d, h:mm a")}
                              </div>
                            </div>
                            <Button size="sm" onClick={() => updateRideStatusMutation.mutate({ id: ride.id, status: 'ongoing' })}>
                              Start
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={Car} title="No scheduled rides" description="Post a ride to get started." action={{ label: "Post a Ride", onClick: () => router.push("/post-ride") }} />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Quick Actions Sidebar */}
            <div>
              <Card className="h-full">
                <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/post-ride" className="block"><Button variant="outline" className="w-full justify-start gap-2"><Plus className="h-4 w-4" /> Post New Ride</Button></Link>
                  <Link href="/my-rides" className="block"><Button variant="outline" className="w-full justify-start gap-2"><Car className="h-4 w-4" /> Manage Rides</Button></Link>
                  <Link href="/bookings" className="block"><Button variant="outline" className="w-full justify-start gap-2"><Users className="h-4 w-4" /> View Bookings</Button></Link>
                  <Link href="/vehicles" className="block"><Button variant="outline" className="w-full justify-start gap-2"><Car className="h-4 w-4" /> My Vehicles</Button></Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PASSENGER VIEW RENDER ---
  const myStatus = selectedRide ? getMyBookingStatus(selectedRide.id) : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        <div className="lg:w-2/5 xl:w-1/3 p-4 lg:p-6 border-r overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Find a Ride</h1>
              <p className="text-sm text-muted-foreground">Search available rides near you</p>
            </div>
            <RoleToggle />
          </div>

          {/* ✅ UPDATED SEARCH UI: Two Inputs */}
          <div className="space-y-3 mb-6 bg-muted/20 p-4 rounded-lg border">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-100" />
              </div>
              <Input 
                placeholder="Pickup Location (e.g. Pindi Gheb)" 
                value={pickupSearch} 
                onChange={(e) => setPickupSearch(e.target.value)} 
                className="pl-9 bg-background" 
              />
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                <div className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-100" />
              </div>
              <Input 
                placeholder="Dropoff Location (e.g. University)" 
                value={dropoffSearch} 
                onChange={(e) => setDropoffSearch(e.target.value)} 
                className="pl-9 bg-background" 
              />
            </div>
          </div>

          <ScrollArea className="flex-1 -mr-4 pr-4">
            {ridesLoading ? (
              <div className="space-y-4"><RideCardSkeleton /><RideCardSkeleton /><RideCardSkeleton /></div>
            ) : filteredRides && filteredRides.length > 0 ? (
              <div className="space-y-4 pb-4">
                {filteredRides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    bookingStatus={getMyBookingStatus(ride.id)} 
                    onViewDetails={() => setSelectedRide(ride)} 
                    onBook={(seats) => createBookingMutation.mutate({ rideId: ride.id, seats })} 
                    onTrack={() => setTrackingRide(ride)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState 
                icon={MapPin} 
                title="No rides found" 
                description={pickupSearch || dropoffSearch ? "Try adjusting your pickup or dropoff location." : "There are no active rides at the moment."} 
              />
            )}
          </ScrollArea>
        </div>

         <div className="hidden lg:block flex-1 bg-muted/10 relative">
             <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                 <div className="text-center">
                     <MapIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                     <p>Select a ride to view details</p>
                 </div>
             </div>
         </div>
      </div>

      {/* RIDE DETAILS DIALOG */}
      <Dialog open={!!selectedRide} onOpenChange={(open) => !open && setSelectedRide(null)}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-none shadow-xl flex flex-col md:flex-row h-[500px]">
          {/* Map Section */}
          <div className="w-full md:w-1/2 h-48 md:h-full relative bg-muted/20">
            {selectedRide && (
              <MapComponent
                center={[selectedRide.sourceLat, selectedRide.sourceLng]}
                zoom={11}
                markers={[
                  { position: [selectedRide.sourceLat, selectedRide.sourceLng], type: "source" },
                  { position: [selectedRide.destLat, selectedRide.destLng], type: "destination" }
                ]}
                interactive={true}
                className="h-full w-full"
              />
            )}
          </div>

          {/* Details Section */}
          <div className="w-full md:w-1/2 flex flex-col p-6 h-full overflow-y-auto">
            {selectedRide && (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 border border-border">
                      <AvatarImage src={selectedRide.driver?.avatar || undefined} />
                      <AvatarFallback className="bg-primary/5 text-primary text-lg">
                        {getInitials(selectedRide.driver?.name || "D")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg leading-none">{selectedRide.driver?.name}</h3>
                        {selectedRide.driver?.cnicStatus === "verified" && (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> 4.8
                        </span>
                        <span>•</span>
                        <span>{selectedRide.vehicle?.model || "Car"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">Rs. {selectedRide.costPerSeat}</div>
                    <div className="text-xs text-muted-foreground">per seat</div>
                  </div>
                </div>

                <Separator className="mb-6" />

                <div className="space-y-6 flex-1">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <div className="w-0.5 h-full bg-border min-h-[2rem] my-1" />
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    </div>
                    <div className="space-y-6 flex-1">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Pickup</p>
                        <p className="text-sm font-medium leading-tight">{selectedRide.sourceAddress}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Dropoff</p>
                        <p className="text-sm font-medium leading-tight">{selectedRide.destAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-2">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Date</span>
                      </div>
                      <p className="font-medium text-sm">{format(new Date(selectedRide.departureTime), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Time</span>
                      </div>
                      <p className="font-medium text-sm">{format(new Date(selectedRide.departureTime), "h:mm a")}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Seats</span>
                      </div>
                      <p className="font-medium text-sm">{selectedRide.seatsAvailable} available</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedRide(null)} className="flex-1">
                    Close
                  </Button>
                  <Button
                    onClick={() => createBookingMutation.mutate({ rideId: selectedRide.id, seats: 1 })}
                    disabled={createBookingMutation.isPending || selectedRide.seatsAvailable === 0 || !!myStatus}
                    className={`flex-[2] ${myStatus === 'accepted' ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {myStatus === 'accepted' ? (
                      <><Check className="mr-2 h-4 w-4" /> Accepted</>
                    ) : myStatus === 'pending' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requested</>
                    ) : createBookingMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                    ) : (
                      "Confirm Request"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* TRACKING DIALOG WITH HEIGHT */}
      <Dialog open={!!trackingRide} onOpenChange={() => setTrackingRide(null)}>
        <DialogContent className="max-w-4xl p-0 h-[500px] overflow-hidden">
          {trackingRide && (
            <div className="h-full w-full">
              <MapComponent
                center={[
                  trackingRide.currentLat || trackingRide.sourceLat,
                  trackingRide.currentLng || trackingRide.sourceLng
                ]}
                zoom={14}
                markers={[
                  {
                    position: [
                      trackingRide.currentLat || trackingRide.sourceLat,
                      trackingRide.currentLng || trackingRide.sourceLng
                    ],
                    label: "Driver (Live)",
                    type: "driver"
                  },
                  {
                    position: [trackingRide.destLat, trackingRide.destLng],
                    label: "Destination",
                    type: "destination"
                  }
                ]}
                interactive={true}
                className="h-full w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}