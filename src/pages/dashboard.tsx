"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Ably from 'ably';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { EmptyState } from "@/components/empty-state";
import { RideCardSkeleton, StatCardSkeleton } from "@/components/loading-skeleton";
import { MapComponent } from "@/components/map-component";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RideWithDriver, Booking } from "@shared/schema";
import {
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
  ArrowRight,
  MessageCircle,
  Check,
  BellRing,
  List,
  Navigation,
  X
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // Search States
  const [pickupSearch, setPickupSearch] = useState("");
  const [dropoffSearch, setDropoffSearch] = useState("");
  
  // Mobile Toggle State
  const [showMap, setShowMap] = useState(false);
  
  const [selectedRide, setSelectedRide] = useState<RideWithDriver | null>(null);
  const [trackingRide, setTrackingRide] = useState<RideWithDriver | null>(null);

  // --- QUERIES ---
  const { data: rides, isLoading: ridesLoading } = useQuery<RideWithDriver[]>({
    queryKey: [activeRole === 'driver' ? `/api/rides?driverId=${user?.id}` : "/api/rides"],
  });

  const { data: bookings, refetch: reloadBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    refetchInterval: activeRole === 'driver' ? 3000 : false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalRides: number;
    totalBookings: number;
    totalEarnings: number;
    activeRides: number;
  }>({
    queryKey: ["/api/stats", user?.id],
    enabled: !!user?.id,
  });

  // --- ABLY SUBSCRIPTION ---
  useEffect(() => {
    if (activeRole !== 'driver' || !user) return;
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
      if (msg.name && (msg.name === 'booking.created' || msg.name === 'booking.updated')) {
        reloadBookings();
        queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
        toast({ title: 'Update', description: 'Your ride status has changed.' });
      }
    };
    driverChannel.subscribe(handler);
    return () => { driverChannel.unsubscribe(handler as any); };
  }, [activeRole, user, reloadBookings, toast]);

  // --- MUTATIONS ---
  const createBookingMutation = useMutation({
    mutationFn: async ({ rideId, seats }: { rideId: string, seats: number }) => {
      return apiRequest("POST", "/api/bookings", { 
        rideId, passengerId: user?.id, seatsBooked: seats 
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
      await apiRequest("PATCH", `/api/bookings/${bookingId}`, { status: action }, { 'x-user-id': user?.id || '' });
      toast({ title: `Request ${action}` });
      reloadBookings();
      queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
    } catch (error) {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  // --- HELPERS ---
  const getId = (item: any) => item ? (typeof item === 'object' ? item._id : item) : null;
  
  const getMyBookingStatus = (rideId: string) => {
    const myBooking = bookings?.find(b => {
      const bRideId = getId(b.rideId);
      const bPassengerId = getId(b.passengerId);
      return bRideId === rideId && bPassengerId === user?.id && b.status !== 'cancelled';
    });
    return myBooking?.status;
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const filteredRides = rides?.filter((ride) => {
    const matchPickup = !pickupSearch || ride.sourceAddress.toLowerCase().includes(pickupSearch.toLowerCase());
    const matchDropoff = !dropoffSearch || ride.destAddress.toLowerCase().includes(dropoffSearch.toLowerCase());
    return matchPickup && matchDropoff;
  });

  // ==========================================
  // DRIVER VIEW (REDESIGNED & PROFESSIONAL)
  // ==========================================
  if (activeRole === "driver") {
    const ongoingRide = rides?.find(r => r.status === 'ongoing');

    const scheduledRequests = bookings?.filter(b => {
        const bRideId = getId(b.rideId);
        const ride = rides?.find(r => r.id === bRideId);
        return b.status === 'pending' && ride && ride.status !== 'completed' && bRideId !== ongoingRide?.id;
    }) || [];

    const activeRideBookings = bookings?.filter(b => getId(b.rideId) === ongoingRide?.id) || [];
    const liveRequests = activeRideBookings.filter(b => b.status === 'pending');
    const acceptedPassengers = activeRideBookings.filter(b => b.status === 'accepted');

    return (
      <div className="bg-muted/5 pb-24 md:pb-8">
        
        {/* TOP BAR: Clean & Simple */}
        <div className="bg-background/80 backdrop-blur-md border-b sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
           <h1 className="font-semibold text-base md:text-lg">Driver Dashboard</h1>
           <RoleToggle />
        </div>

        <div className="container px-4 py-6 max-w-2xl mx-auto space-y-6">
          
          {/* --- 1. URGENT: LIVE RIDE (Takes Priority) --- */}
          {ongoingRide ? (
             <div className="space-y-4">
               {/* Live Status Header */}
               <div className="flex items-center justify-between bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-900/10">
                  <div className="flex items-center gap-3">
                     <div className="h-2.5 w-2.5 bg-white rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                     <div>
                       <h2 className="font-bold text-base md:text-lg">Ride is Live</h2>
                       <p className="text-[10px] md:text-xs text-emerald-100 opacity-90">Heading to {ongoingRide.destAddress}</p>
                     </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="text-emerald-700 hover:bg-white border-none shadow-none text-xs md:text-sm h-8"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${ongoingRide.destLat},${ongoingRide.destLng}`, '_blank')}
                  >
                    <Navigation className="h-3 w-3 mr-2" /> Navigate
                  </Button>
               </div>

               {/* Passenger Manifest */}
               <Card className="border-none shadow-md overflow-hidden">
                 <CardHeader className="pb-3 pt-4 px-4 bg-muted/20 border-b border-border/50">
                   <div className="flex justify-between items-center">
                     <CardTitle className="text-sm md:text-base font-medium">Passengers ({acceptedPassengers.length})</CardTitle>
                     <Badge variant="outline" className="text-[10px] md:text-xs font-normal">{ongoingRide.seatsAvailable} seats left</Badge>
                   </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    {acceptedPassengers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                         <Users className="h-8 w-8 mb-2 opacity-20" />
                         <p className="text-xs md:text-sm">Waiting for passengers...</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {acceptedPassengers.map((booking: any) => (
                          <div key={booking._id || booking.id} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                             <div className="flex items-center gap-3">
                               <Avatar className="h-9 w-9 border border-border">
                                 <AvatarImage src={booking.passengerId?.avatar} />
                                 <AvatarFallback className="text-xs">{booking.passengerId?.name?.[0]}</AvatarFallback>
                               </Avatar>
                               <div>
                                 <p className="font-semibold text-sm">{booking.passengerId?.name}</p>
                                 <div className="flex gap-2 mt-0.5">
                                   <Badge variant="secondary" className="text-[10px] h-4 px-1">{booking.seatsBooked} seat</Badge>
                                 </div>
                               </div>
                             </div>
                             <Link href={`/chat/${booking._id || booking.id}`}>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                             </Link>
                          </div>
                        ))}
                      </div>
                    )}
                 </CardContent>
                 <CardFooter className="p-4 bg-muted/10 border-t border-border/50">
                   <Button 
                     variant="destructive" 
                     className="w-full h-10 md:h-12 text-sm md:text-base shadow-sm hover:shadow-md transition-all"
                     onClick={() => updateRideStatusMutation.mutate({ id: ongoingRide.id, status: 'completed' })}
                   >
                     End Ride
                   </Button>
                 </CardFooter>
               </Card>

               {/* Live Requests (Popups) */}
               {liveRequests.length > 0 && (
                 <div className="animate-in slide-in-from-bottom-5 fade-in duration-500">
                   <div className="flex items-center justify-between px-2 mb-2">
                      <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">New Requests</h3>
                   </div>
                   {liveRequests.map((booking: any) => (
                      <Card key={booking._id || booking.id} className="mb-3 border-l-4 border-l-amber-500 shadow-md">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                               <Avatar className="h-9 w-9">
                                 <AvatarFallback className="text-xs">Req</AvatarFallback>
                               </Avatar>
                               <div>
                                 <p className="font-bold text-sm">{booking.passengerId?.name}</p>
                                 <p className="text-[10px] md:text-xs text-muted-foreground">Nearby • {booking.seatsBooked} Seat(s)</p>
                               </div>
                             </div>
                             <Badge className="bg-amber-500 text-[10px] hover:bg-amber-600">Urgent</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                             <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={() => handleBookingAction(booking._id || booking.id, 'accepted')}>Accept</Button>
                             <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-9" onClick={() => handleBookingAction(booking._id || booking.id, 'rejected')}>Decline</Button>
                          </div>
                        </CardContent>
                      </Card>
                   ))}
                 </div>
               )}
             </div>
          ) : (
            <>
              {/* --- 2. SUMMARY (PROFESSIONAL BOXES) --- */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Earnings Box */}
                <div className="bg-card p-3 md:p-4 rounded-xl border shadow-sm flex flex-col justify-between h-24 md:h-28 relative overflow-hidden group">
                   <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                      <Banknote className="h-16 w-16 text-emerald-600" />
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-md">
                         <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">Earnings</p>
                   </div>
                   <p className="text-lg md:text-2xl font-bold text-foreground tracking-tight">
                     Rs. {stats?.totalEarnings || 0}
                   </p>
                </div>

                {/* Rides Box */}
                <div className="bg-card p-3 md:p-4 rounded-xl border shadow-sm flex flex-col justify-between h-24 md:h-28 relative overflow-hidden group">
                   <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                      <Car className="h-16 w-16 text-blue-600" />
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 bg-blue-100/50 dark:bg-blue-900/30 rounded-md">
                         <Car className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Rides</p>
                   </div>
                   <p className="text-lg md:text-2xl font-bold text-foreground tracking-tight">
                     {stats?.totalRides || 0}
                   </p>
                </div>
              </div>

              {/* --- 3. PENDING REQUESTS --- */}
              {scheduledRequests.length > 0 ? (
                <div>
                   <h3 className="font-bold text-sm md:text-base mb-3 flex items-center gap-2">
                     <div className="relative">
                        <BellRing className="h-4 w-4 text-foreground" />
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 border border-white animate-pulse" />
                     </div>
                     Action Needed ({scheduledRequests.length})
                   </h3>
                   <div className="space-y-3">
                     {scheduledRequests.map((booking: any) => {
                       const rideInfo = rides?.find(r => r.id === getId(booking.rideId));
                       return (
                         <Card key={booking._id || booking.id} className="shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
                           <CardContent className="p-4">
                             <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                   <Avatar className="h-10 w-10 border border-border">
                                     <AvatarImage src={booking.passengerId?.avatar} />
                                     <AvatarFallback className="text-xs">{booking.passengerId?.name?.[0]}</AvatarFallback>
                                   </Avatar>
                                   <div>
                                      <p className="font-bold text-sm">{booking.passengerId?.name}</p>
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                         <span>To:</span>
                                         <span className="font-medium text-foreground">{rideInfo?.destAddress}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <Badge variant="secondary" className="text-[10px] font-normal">{booking.seatsBooked} Seat(s)</Badge>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                               <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 h-9" onClick={() => handleBookingAction(booking._id || booking.id, 'accepted')}>
                                 <Check className="mr-1.5 h-3.5 w-3.5" /> Accept
                               </Button>
                               <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 h-9 hover:bg-red-50" onClick={() => handleBookingAction(booking._id || booking.id, 'rejected')}>
                                 <X className="mr-1.5 h-3.5 w-3.5" /> Decline
                               </Button>
                             </div>
                           </CardContent>
                         </Card>
                       );
                     })}
                   </div>
                </div>
              ) : (
                 <div className="bg-muted/30 border border-border/50 p-4 rounded-xl flex items-center gap-3">
                    <div className="h-8 w-8 bg-background rounded-full flex items-center justify-center shadow-sm">
                       <Check className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                       <p className="font-medium text-sm">All caught up!</p>
                       <p className="text-xs text-muted-foreground">No pending requests.</p>
                    </div>
                 </div>
              )}

              {/* --- 4. UPCOMING RIDES --- */}
              <div>
                 <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm md:text-base">Upcoming Schedule</h3>
                    <Link href="/post-ride">
                       <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                          <Plus className="h-3 w-3" /> New
                       </Button>
                    </Link>
                 </div>
                 
                 {filteredRides && filteredRides.filter(r => r.driverId === user?.id && r.status === 'scheduled').length > 0 ? (
                   <div className="space-y-3">
                      {filteredRides.filter((r) => r.driverId === user?.id && r.status === 'scheduled').map((ride) => (
                         <div key={ride.id} className="bg-card p-4 rounded-xl border shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md">
                            <div className="flex justify-between items-start">
                               <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                     <span className="truncate max-w-[100px] md:max-w-[150px]">{ride.sourceAddress}</span>
                                     <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                     <span className="truncate max-w-[100px] md:max-w-[150px]">{ride.destAddress}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                     <Calendar className="h-3 w-3" />
                                     {format(new Date(ride.departureTime), "EEE, MMM d • h:mm a")}
                                  </div>
                               </div>
                               <Badge variant="outline" className="text-[10px] font-normal">{ride.seatsAvailable} seats</Badge>
                            </div>
                            <Button size="sm" className="w-full h-9" onClick={() => updateRideStatusMutation.mutate({ id: ride.id, status: 'ongoing' })}>
                               Start Ride
                            </Button>
                         </div>
                      ))}
                   </div>
                 ) : (
                    <EmptyState 
                       icon={Car} 
                       title="No Upcoming Rides" 
                       description="Post a ride to start earning."
                       action={{ label: "Post a Ride", onClick: () => router.push("/post-ride") }} 
                       className="py-8"
                    />
                 )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // PASSENGER VIEW (Responsive Split)
  // ==========================================
  const myStatus = selectedRide ? getMyBookingStatus(selectedRide.id) : undefined;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background relative flex flex-col lg:flex-row overflow-hidden">
      
      {/* --- SIDEBAR (List View) --- */}
      <div className={`w-full lg:w-[400px] xl:w-[450px] flex-shrink-0 flex flex-col border-r h-[calc(100vh-4rem)] z-10 bg-background ${showMap ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="p-4 border-b bg-background z-20">
          <div className="flex items-center justify-between mb-4">
             <h1 className="text-lg md:text-xl font-bold">Find a Ride</h1>
             <div className="hidden lg:block"><RoleToggle /></div>
          </div>

          {/* Styled Search Inputs (Uber Style) */}
          <div className="bg-muted/30 p-4 rounded-xl border space-y-0 relative">
             <div className="absolute left-[27px] top-[28px] bottom-[28px] w-0.5 bg-border z-0"></div>
             <div className="relative z-10 mb-3">
               <div className="absolute left-3 top-3 h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-background"></div>
               <Input 
                 placeholder="From (e.g. Pindi Gheb)" 
                 value={pickupSearch} 
                 onChange={(e) => setPickupSearch(e.target.value)} 
                 className="pl-8 bg-background border-transparent shadow-none focus-visible:ring-0 focus-visible:bg-background h-10 text-sm" 
               />
             </div>
             <Separator className="my-2" />
             <div className="relative z-10 mt-3">
               <div className="absolute left-3 top-3 h-2 w-2 rounded-full bg-rose-500 ring-4 ring-background"></div>
               <Input 
                 placeholder="To (e.g. University)" 
                 value={dropoffSearch} 
                 onChange={(e) => setDropoffSearch(e.target.value)} 
                 className="pl-8 bg-background border-transparent shadow-none focus-visible:ring-0 focus-visible:bg-background h-10 text-sm" 
               />
             </div>
          </div>
        </div>

        {/* Scrollable List */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4 pb-24 lg:pb-8"> 
            {ridesLoading ? (
              [...Array(3)].map((_, i) => <RideCardSkeleton key={i} />)
            ) : filteredRides && filteredRides.length > 0 ? (
              filteredRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  bookingStatus={getMyBookingStatus(ride.id)} 
                  onViewDetails={() => setSelectedRide(ride)} 
                  onBook={(seats) => createBookingMutation.mutate({ rideId: ride.id, seats })} 
                />
              ))
            ) : (
              <EmptyState 
                icon={MapPin} 
                title="No rides found" 
                description="Try adjusting your search filters." 
                className="mt-10"
              />
            )}
          </div>
        </ScrollArea>
      </div>

      {/* --- MAIN CONTENT (Map View) --- */}
      <div className={`flex-1 relative bg-muted/10 h-[calc(100vh-4rem)] ${showMap ? 'block' : 'hidden lg:block'}`}>
        <MapComponent 
          center={[33.6844, 73.0479]} 
          zoom={10}
          className="h-full w-full"
        />
        
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 lg:hidden">
          <Button 
             onClick={() => setShowMap(false)}
             className="rounded-full shadow-lg px-6 bg-background text-foreground hover:bg-muted border h-10 text-sm"
          >
             <List className="mr-2 h-4 w-4" /> Show List
          </Button>
        </div>
      </div>

      {!showMap && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 lg:hidden">
           <Button 
             onClick={() => setShowMap(true)} 
             className="rounded-full shadow-lg bg-foreground text-background px-6 h-10 text-sm"
           >
             <MapIcon className="mr-2 h-4 w-4" /> Map View
           </Button>
        </div>
      )}

      {/* --- RIDE DETAIL DIALOG --- */}
      <Dialog open={!!selectedRide} onOpenChange={(open) => !open && setSelectedRide(null)}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-none shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[500px]">
          <div className="w-full md:w-1/2 h-40 md:h-full relative bg-muted/20">
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

          <div className="w-full md:w-1/2 flex flex-col p-5 md:p-6 h-full overflow-y-auto bg-background">
            {selectedRide && (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Avatar className="h-12 w-12 md:h-14 md:w-14 border-2 border-border">
                      <AvatarImage src={selectedRide.driver?.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {getInitials(selectedRide.driver?.name || "D")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base md:text-lg leading-none">{selectedRide.driver?.name}</h3>
                        {selectedRide.driver?.cnicStatus === "verified" && (
                          <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 text-[10px] md:text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm dark:bg-amber-900/30 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-current" /> 4.8
                        </span>
                        <span>{selectedRide.vehicle?.model || "Car"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-bold text-primary">Rs.{selectedRide.costPerSeat}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">per seat</div>
                  </div>
                </div>

                <Separator className="mb-6" />

                <div className="space-y-6 flex-1">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center pt-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <div className="w-0.5 h-full bg-border min-h-[3rem] my-1" />
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
                    </div>
                    <div className="space-y-6 flex-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Pickup</p>
                        <p className="text-sm font-medium leading-snug">{selectedRide.sourceAddress}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Dropoff</p>
                        <p className="text-sm font-medium leading-snug">{selectedRide.destAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-muted/30 p-2.5 rounded-lg text-center">
                       <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                       <div className="text-xs font-medium">{format(new Date(selectedRide.departureTime), "MMM d")}</div>
                    </div>
                    <div className="bg-muted/30 p-2.5 rounded-lg text-center">
                       <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                       <div className="text-xs font-medium">{format(new Date(selectedRide.departureTime), "h:mm a")}</div>
                    </div>
                    <div className="bg-muted/30 p-2.5 rounded-lg text-center">
                       <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                       <div className={cn("text-xs font-medium", selectedRide.seatsAvailable === 0 && "text-red-600")}>
                         {selectedRide.seatsAvailable} Left
                       </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedRide(null)} className="flex-1 h-11 md:h-12 text-sm">
                    Close
                  </Button>
                  <Button
                    onClick={() => createBookingMutation.mutate({ rideId: selectedRide.id, seats: 1 })}
                    disabled={createBookingMutation.isPending || selectedRide.seatsAvailable === 0 || !!myStatus}
                    className={cn(
                      "flex-[2] h-11 md:h-12 text-sm md:text-base font-semibold shadow-md transition-all",
                      myStatus === 'accepted' ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    )}
                  >
                    {myStatus === 'accepted' ? (
                      <><Check className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Accepted</>
                    ) : myStatus === 'pending' ? (
                      <><Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" /> Requested</>
                    ) : createBookingMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" /> Sending...</>
                    ) : (
                      "Request Ride"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}