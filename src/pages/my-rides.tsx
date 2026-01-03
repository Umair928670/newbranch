"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { BookingCard } from "@/components/booking-card";
import { EmptyState } from "@/components/empty-state";
import { RideCardSkeleton } from "@/components/loading-skeleton";
import { MapComponent } from "@/components/map-component";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RideWithDriver, BookingWithDetails } from "@shared/schema";
import {
  Plus,
  Car,
  Users,
  Clock,
  Calendar,
  MessageCircle,
  Trash2,
  Play,
  CheckCircle,
  Navigation,
  MapPin,
  Eye,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function MyRides() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [selectedRide, setSelectedRide] = useState<RideWithDriver | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState<string | null>(null);

  // Fetch Data
  const { data: rides, isLoading: ridesLoading } = useQuery<RideWithDriver[]>({
    queryKey: [`/api/rides?driverId=${user?.id}`], 
    enabled: !!user?.id,
  });
  const { data: bookings } = useQuery<BookingWithDetails[]>({
    queryKey: ["/api/bookings"],
  });

  const myRides = rides || [];
  
  // Status Logic
  const activeOngoingRide = myRides.find(r => r.status === "ongoing");
  const activeRides = myRides.filter((ride) => ride.isActive && ride.status === "scheduled");
  const pastRides = myRides.filter((ride) => !ride.isActive || ride.status === "completed");
  
  const pendingBookings = bookings?.filter(
    (b) => b.status === "pending" && myRides.some((r) => r.id === b.rideId)
  ) || [];

  // --- Tracking Logic ---
  useEffect(() => {
    let watchId: number;
    if (activeOngoingRide && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          apiRequest("PATCH", `/api/rides/${activeOngoingRide.id}/location`, {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error("Tracking Error:", error),
        { enableHighAccuracy: true }
      );
      toast({ title: "Live Tracking Active", description: "Sharing location with passengers." });
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [activeOngoingRide?.id]);

  // --- Mutations ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ rideId, status }: { rideId: string, status: string }) => {
      return apiRequest("PATCH", `/api/rides/${rideId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rides?driverId=${user?.id}`] });
      toast({ title: "Status Updated" });
    }
  });

  const deleteRideMutation = useMutation({
    mutationFn: async (rideId: string) => { return apiRequest("DELETE", `/api/rides/${rideId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: [
          `/api/rides?driverId=${user.id}`
        ] });
      }
      toast({ title: "Ride deleted" });
      setDeleteDialogOpen(false);
    },
  });

  const handleBookingAction = useMutation({
    mutationFn: async ({ bookingId, action }: { bookingId: string; action: "accept" | "reject" }) => {
      return apiRequest("PATCH", `/api/bookings/${bookingId}`, { status: action === "accept" ? "accepted" : "rejected" });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: action === "accept" ? "Booking accepted" : "Booking rejected" });
    },
  });

  const confirmDelete = () => { if (rideToDelete) deleteRideMutation.mutate(rideToDelete); };

  // --- Reusable Ride List Item ---
  const RideListItem = ({ ride, isPast = false }: { ride: RideWithDriver, isPast?: boolean }) => (
    <Card className={cn("overflow-hidden hover:shadow-md transition-all group", isPast && "opacity-80")}>
      <CardHeader className="pb-3 pt-4 px-4 bg-muted/5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Badge variant={isPast ? "secondary" : "outline"} className={cn("font-normal", !isPast && "bg-emerald-50 text-emerald-700 border-emerald-200")}>
               {isPast ? "Completed" : "Scheduled"}
             </Badge>
             <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                {ride.seatsTotal - ride.seatsAvailable}/{ride.seatsTotal}
             </span>
          </div>
          <div className="text-right">
             <span className="font-bold text-primary">Rs. {ride.costPerSeat}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 pb-4 px-4 space-y-4">
        {/* Visual Timeline */}
        <div className="relative pl-2">
           <div className="absolute left-[5px] top-[6px] bottom-[6px] w-0.5 bg-gradient-to-b from-emerald-500/50 to-rose-500/50" />
           <div className="space-y-3">
              <div className="flex gap-3 relative">
                 <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-background z-10 mt-1" />
                 <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">From</p>
                    <p className="text-sm font-medium leading-tight truncate">{ride.sourceAddress}</p>
                 </div>
              </div>
              <div className="flex gap-3 relative">
                 <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-background z-10 mt-1" />
                 <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">To</p>
                    <p className="text-sm font-medium leading-tight truncate">{ride.destAddress}</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg">
           <Calendar className="h-3.5 w-3.5" />
           <span>{format(new Date(ride.departureTime), "EEEE, MMM d")}</span>
           <span className="mx-1">•</span>
           <Clock className="h-3.5 w-3.5" />
           <span>{format(new Date(ride.departureTime), "h:mm a")}</span>
        </div>
      </CardContent>

      {!isPast && (
        <CardFooter className="pt-0 px-4 pb-4 flex gap-2">
           <Button 
             className="flex-1 bg-green-600 hover:bg-green-700 h-9 text-xs" 
             onClick={() => updateStatusMutation.mutate({ rideId: ride.id, status: "ongoing" })}
           >
             <Play className="mr-1.5 h-3.5 w-3.5" /> Start
           </Button>
           <Button 
             variant="outline" 
             size="sm" 
             className="flex-1 h-9 text-xs" 
             onClick={() => setSelectedRide(ride)}
           >
             <Eye className="mr-1.5 h-3.5 w-3.5" /> Details
           </Button>
           <Button 
             variant="ghost" 
             size="icon" 
             className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50"
             onClick={() => { setRideToDelete(ride.id); setDeleteDialogOpen(true); }}
           >
             <Trash2 className="h-4 w-4" />
           </Button>
        </CardFooter>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/5 pb-24 md:pb-8">
      <div className="container px-4 py-4 max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Rides</h1>
            <p className="text-sm text-muted-foreground">Manage your posted rides and booking requests</p>
          </div>
        </div>

        {/* --- Active Ride Control (Hero Card) --- */}
        {activeOngoingRide && (
          <Card className="mb-8 border-green-500 shadow-lg bg-green-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Ride in Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Destination</p>
                <p className="font-semibold text-lg">{activeOngoingRide.destAddress}</p>
              </div>
              <Navigation className="h-8 w-8 text-green-600 animate-pulse" />
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white" 
                onClick={() => updateStatusMutation.mutate({ rideId: activeOngoingRide.id, status: "completed" })}>
                <CheckCircle className="mr-2 h-4 w-4" /> Finish Ride
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* --- Pending Bookings Section --- */}
        {pendingBookings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
               <h2 className="text-lg font-bold">Pending Requests</h2>
               <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">{pendingBookings.length} new</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  viewAs="driver"
                  onAccept={() => handleBookingAction.mutate({ bookingId: booking.id, action: "accept" })}
                  onReject={() => handleBookingAction.mutate({ bookingId: booking.id, action: "reject" })}
                />
              ))}
            </div>
          </div>
        )}

        {/* --- Tabs Section --- */}
        <Tabs defaultValue="active" className="space-y-4">
          <div className="overflow-x-auto pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scrollbar-hide">
             <TabsList className="w-full md:w-auto inline-flex h-10 p-1 bg-muted/80 backdrop-blur rounded-xl">
               <TabsTrigger value="active" className="gap-2 flex-1 md:flex-none px-6">
                 <Car className="h-4 w-4" /> Active ({activeRides.length})
               </TabsTrigger>
               <TabsTrigger value="past" className="gap-2 flex-1 md:flex-none px-6">
                 <Clock className="h-4 w-4" /> Past ({pastRides.length})
               </TabsTrigger>
             </TabsList>
          </div>

          <TabsContent value="active" className="mt-0">
            {ridesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <RideCardSkeleton /><RideCardSkeleton />
              </div>
            ) : activeRides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in duration-500">
                {activeRides.map((ride) => <RideListItem key={ride.id} ride={ride} />)}
              </div>
            ) : (
              <EmptyState 
                icon={Car} 
                title="No active rides" 
                description="Post a new ride to start earning." 
                action={{ label: "Post a Ride", onClick: () => router.push("/post-ride") }} 
              />
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {pastRides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in duration-500">
                {pastRides.map((ride) => <RideListItem key={ride.id} ride={ride} isPast />)}
              </div>
            ) : (
              <EmptyState icon={Clock} title="No past rides" description="Your ride history is empty." />
            )}
          </TabsContent>
        </Tabs>
      </div>

     {/* Ride Details Dialog */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent 
          className="
            max-w-md w-[95%] p-0 gap-0 border-none shadow-2xl bg-background/95 backdrop-blur-xl overflow-hidden rounded-2xl flex flex-col max-h-[85vh]
            data-[state=open]:animate-in data-[state=closed]:animate-out 
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 
            data-[state=closed]:slide-out-to-bottom-10 data-[state=open]:slide-in-from-bottom-10
            duration-300
          "
        >
          
          {/* 1. Map Header (Increased Height) */}
          <div className="relative h-56 w-full shrink-0">
            {selectedRide && (
              <>
                <div className="absolute top-0 left-0 w-full h-full z-0">
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
                </div>
              </>
            )}
          </div>

          {/* 2. Content Body */}
          <div className="flex flex-col flex-1 overflow-hidden relative z-10">
            
            {/* Header Section */}
            <div className="px-5 pt-4 pb-2 shrink-0">
               <div className="flex items-center justify-between mb-1">
                 <h3 className="font-bold text-sm flex items-center gap-2">
                   Passenger Manifest
                 </h3>
                 <div className="flex gap-1">
                    {Array.from({ length: selectedRide?.seatsTotal || 0 }).map((_, i) => {
                       const bookedCount = bookings?.filter(b => {
                          const rId = (b.rideId && typeof b.rideId === 'object') ? (b.rideId as any)._id : b.rideId;
                          return rId === selectedRide?.id && b.status === 'accepted';
                       }).length || 0;
                       
                       const isBooked = i < bookedCount;
                       return (
                          <div key={i} className={cn(
                             "h-2 w-2 rounded-full transition-all",
                             isBooked ? "bg-primary" : "bg-muted border border-muted-foreground/30"
                          )} />
                       );
                    })}
                 </div>
               </div>
            </div>

            {/* Scrollable Passenger List (Single Block Style) */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
              {selectedRide && (() => {
                 const currentPassengers = bookings?.filter(b => {
                    if (!b.rideId) return false;
                    const rId = typeof b.rideId === 'object' ? (b.rideId as any)._id : b.rideId;
                    return rId === selectedRide.id && b.status === 'accepted';
                 }) || [];

                 if (currentPassengers.length === 0) {
                    return (
                       <div className="h-24 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20 mt-2">
                          <Users className="h-6 w-6 mb-2 opacity-20" />
                          <p className="text-sm font-medium">No passengers yet</p>
                       </div>
                    );
                 }

                 return (
                   <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                     {currentPassengers.map((booking: any, index: number) => (
                       <div 
                         key={booking._id || booking.id} 
                         className={cn(
                           "group flex items-center justify-between p-3 hover:bg-muted/30 transition-colors",
                           index !== currentPassengers.length - 1 && "border-b border-border/60"
                         )}
                       >
                         <div className="flex items-center gap-3">
                           <div className="relative">
                             <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-muted">
                                {booking.passengerId?.avatar ? (
                                  <img src={booking.passengerId.avatar} alt="User" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                                    {booking.passengerId?.name?.[0] || "U"}
                                  </div>
                                )}
                             </div>
                             {/* Status Dot */}
                             <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                           </div>
                           
                           <div className="flex flex-col">
                             <span className="font-semibold text-sm text-foreground">{booking.passengerId?.name}</span>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium">
                                   {booking.seatsBooked} Seat{booking.seatsBooked > 1 ? 's' : ''}
                                </span>
                             </div>
                           </div>
                         </div>
                         
                         <Link href={`/chat/${booking._id || booking.id}`}>
                           <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50">
                             <MessageCircle className="h-4 w-4" />
                           </Button>
                         </Link>
                       </div>
                     ))}
                   </div>
                 );
              })()}
            </div>
            
            {/* Footer / Close Action */}
            <div className="p-4 border-t bg-muted/5 mt-auto">
                <Button variant="outline" className="w-full h-10 rounded-xl font-semibold text-sm shadow-sm" onClick={() => setSelectedRide(null)}>
                  Close Details
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
     

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[90%] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ride?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ride? This action cannot be undone and any pending bookings will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 rounded-lg">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}