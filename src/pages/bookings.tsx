"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapComponent } from "@/components/map-component";

import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { RoleToggle } from "@/components/role-toggle";
import { BookingCard } from "@/components/booking-card";
import { EmptyState } from "@/components/empty-state";
import { BookingCardSkeleton } from "@/components/loading-skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { BookingWithDetails } from "@shared/schema";
import { Clock, Check, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils"; // Ensure this is imported

export default function Bookings() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  
  const [trackingRide, setTrackingRide] = useState<any | null>(null);

  const { data: bookings, isLoading } = useQuery<BookingWithDetails[]>({
    queryKey: ["/api/bookings"],
    refetchInterval: 3000, 
  });

  const getId = (item: any) => {
    if (!item) return null;
    return typeof item === 'object' ? item._id : item;
  };

  const myBookings = bookings?.filter((b) => {
    if (activeRole === "driver") {
      const ride = b.rideId as any; 
      const rideDriverId = ride ? getId(ride.driverId) : null;
      const directDriverId = getId(b.driver);
      
      return rideDriverId === user?.id || directDriverId === user?.id;
    } else {
      return getId(b.passengerId) === user?.id;
    }
  }) || [];

  const pendingBookings = myBookings.filter((b) => b.status === "pending");
  const acceptedBookings = myBookings.filter((b) => b.status === "accepted");
  
  const pastBookings = myBookings.filter(
    (b) => 
      b.status === "rejected" || 
      b.status === "cancelled" || 
      (b.ride && (b.ride as any).status === "completed") 
  );

  const handleBookingAction = useMutation({
    mutationFn: async ({
      bookingId,
      action,
    }: {
      bookingId: string;
      action: "accept" | "reject" | "cancel";
    }) => {
      const status =
        action === "accept"
          ? "accepted"
          : action === "reject"
          ? "rejected"
          : "cancelled";
      // Send caller identity for server auth
      return apiRequest(
        "PATCH",
        `/api/bookings/${bookingId}`,
        { status },
        { "x-user-id": user?.id || "" }
      );
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      const messages = {
        accept: "Booking accepted",
        reject: "Booking rejected",
        cancel: "Booking cancelled",
      };
      toast({ title: messages[action] });
      setCancelDialogOpen(false);
      setBookingToCancel(null);
    },
    onError: (error: any) => {
      toast({
        title: "Action failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const confirmCancel = () => {
    if (bookingToCancel) {
      handleBookingAction.mutate({
        bookingId: bookingToCancel,
        action: "cancel",
      });
    }
  };

  const renderBookingsList = (bookingsList: BookingWithDetails[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      );
    }

    if (bookingsList.length === 0) {
      return (
        <EmptyState
          icon={Calendar}
          title="No bookings found"
          description={
            activeRole === "driver"
              ? "Requests from passengers will appear here."
              : "Your ride requests will appear here."
          }
          className="mt-8"
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {bookingsList.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            viewAs={activeRole}
            onAccept={() =>
              handleBookingAction.mutate({
                bookingId: booking.id,
                action: "accept",
              })
            }
            onReject={() =>
              handleBookingAction.mutate({
                bookingId: booking.id,
                action: "reject",
              })
            }
            onCancel={() => {
              setBookingToCancel(booking.id);
              setCancelDialogOpen(true);
            }}
            onTrack={() => setTrackingRide(booking.ride || booking.rideId)}
          />
        ))}
      </div>
    );
  };

  return (
    // ✅ 1. Mobile-First Container (pb-24 for Nav Bar)
    <div className="min-h-screen bg-muted/5 pb-24 md:pb-8">
      <div className="container px-4 py-4 max-w-6xl mx-auto">
        
        {/* ✅ 2. Responsive Header (Stack on mobile, Row on desktop) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bookings</h1>
            <p className="text-sm text-muted-foreground">
              {activeRole === "driver"
                ? "Manage requests from passengers"
                : "Track your current and past rides"}
            </p>
          </div>
          <div className="w-full md:w-auto">
             <RoleToggle />
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-3">
          {/* ✅ 3. Scrollable Tabs Wrapper */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 scrollbar-hide">
              <TabsList className="w-full md:w-auto inline-flex h-11 md:h-10 p-1 bg-muted/80 backdrop-blur rounded-xl">
                
                <TabsTrigger value="pending" className="gap-2 flex-1 md:flex-none px-4 md:px-6 h-9 rounded-lg data-[state=active]:shadow-sm">
                  <Clock className="h-4 w-4" />
                  <span>Pending</span>
                </TabsTrigger>

                <TabsTrigger value="accepted" className="gap-2 flex-1 md:flex-none px-4 md:px-6 h-9 rounded-lg data-[state=active]:shadow-sm">
                  <Check className="h-4 w-4" />
                  <span>Accepted</span>
                </TabsTrigger>

                <TabsTrigger value="past" className="gap-2 flex-1 md:flex-none px-4 md:px-6 h-9 rounded-lg data-[state=active]:shadow-sm">
                  <X className="h-4 w-4" />
                  <span>Past</span>
                </TabsTrigger>

              </TabsList>
          </div>

          <TabsContent value="pending" className="animate-in slide-in-from-left-2 duration-300">
            {renderBookingsList(pendingBookings)}
          </TabsContent>

          <TabsContent value="accepted" className="animate-in slide-in-from-right-2 duration-300">
            {renderBookingsList(acceptedBookings)}
          </TabsContent>

          <TabsContent value="past" className="animate-in fade-in zoom-in-95 duration-300">
            {renderBookingsList(pastBookings)}
          </TabsContent>
        </Tabs>
      </div>

      {/* ✅ 4. Tracking Dialog - Mobile Sizing */}
      <Dialog open={!!trackingRide} onOpenChange={() => setTrackingRide(null)}>
        <DialogContent className="max-w-3xl w-[95%] h-[80vh] md:h-[600px] p-0 gap-0 border-none overflow-hidden shadow-2xl rounded-xl">
          {trackingRide && (
            <div className="relative h-full w-full">
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
                className="h-full w-full"
              />
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-4 right-4 shadow-md bg-white/90 hover:bg-white"
                onClick={() => setTrackingRide(null)}
              >
                Close Map
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ 5. Cancel Dialog - Mobile Sizing */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-[400px] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg mt-2 sm:mt-0">Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}