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
  DialogDescription,
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
  Trash2,
  Play,
  CheckCircle,
  Navigation
} from "lucide-react";
import { format } from "date-fns";

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Rides</h1>
            <p className="text-muted-foreground">Manage your posted rides and booking requests</p>
          </div>
          <Link href="/post-ride">
            <Button className="gap-2" data-testid="button-post-ride">
              <Plus className="h-4 w-4" /> Post New Ride
            </Button>
          </Link>
        </div>

        {/* --- Active Ride Control --- */}
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

        {/* --- Pending Bookings --- */}
        {pendingBookings.length > 0 && (
          <Card className="mb-8 border-yellow-500/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Pending Requests</CardTitle>
                <Badge className="bg-yellow-500/10 text-yellow-600">{pendingBookings.length} new</Badge>
              </div>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

        {/* --- Tabs --- */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" className="gap-2"><Car className="h-4 w-4" /> Active ({activeRides.length})</TabsTrigger>
            <TabsTrigger value="past" className="gap-2"><Clock className="h-4 w-4" /> Past ({pastRides.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {ridesLoading ? (
              <div className="grid grid-cols-1 gap-6"><RideCardSkeleton /></div>
            ) : activeRides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeRides.map((ride) => (
                  <Card key={ride.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Scheduled</Badge>
                        <span className="text-sm text-muted-foreground">{ride.seatsAvailable}/{ride.seatsTotal} seats</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="font-medium truncate">{ride.destAddress}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(ride.departureTime), "MMM d, h:mm a")}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="font-bold">Rs. {ride.costPerSeat}</span>
                        <div className="flex gap-2">
                          <Button className="bg-green-600 hover:bg-green-700 h-8" size="sm" onClick={() => updateStatusMutation.mutate({ rideId: ride.id, status: "ongoing" })}>
                            <Play className="mr-1 h-3 w-3" /> Start
                          </Button>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedRide(ride)}>View</Button>
                          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => { setRideToDelete(ride.id); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={Car} title="No active rides" description="Post a new ride to start." action={{ label: "Post a Ride", onClick: () => router.push("/post-ride") }} />
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastRides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastRides.map((ride) => (
                  <Card key={ride.id} className="opacity-75">
                    <CardHeader className="pb-3"><Badge variant="secondary">Completed</Badge></CardHeader>
                    <CardContent>
                      <p className="font-medium truncate">{ride.destAddress}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(ride.departureTime), "MMM d")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <EmptyState icon={Clock} title="No past rides" description="History empty." />}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Ride Details</DialogTitle></DialogHeader>
          {selectedRide && (
            <div className="space-y-4">
              <div className="h-48 rounded-lg overflow-hidden">
                <MapComponent center={[selectedRide.sourceLat, selectedRide.sourceLng]} zoom={10} markers={[{ position: [selectedRide.sourceLat, selectedRide.sourceLng], type: "source" }, { position: [selectedRide.destLat, selectedRide.destLng], type: "destination" }]} interactive={false} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">From</p><p className="font-medium">{selectedRide.sourceAddress}</p></div>
                <div><p className="text-sm text-muted-foreground">To</p><p className="font-medium">{selectedRide.destAddress}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ride?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}