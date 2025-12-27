"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // ✅ HELPER: Safely extract ID from Object or String
  const getId = (item: any) => {
    if (!item) return null;
    return typeof item === 'object' ? item._id : item;
  };

  const myBookings = bookings?.filter((b) => {
    if (activeRole === "driver") {
      const ride = b.rideId as any; // Cast to access populated fields
      const rideDriverId = ride ? getId(ride.driverId) : null;
      const directDriverId = getId(b.driver);
      
      return rideDriverId === user?.id || directDriverId === user?.id;
    } else {
      return getId(b.passengerId) === user?.id;
    }
  }) || [];

  const pendingBookings = myBookings.filter((b) => b.status === "pending");
  const acceptedBookings = myBookings.filter((b) => b.status === "accepted");
  
  // ✅ FIX: "Past" includes rejected/cancelled bookings OR accepted bookings where the RIDE is completed
  const pastBookings = myBookings.filter(
    (b) => 
      b.status === "rejected" || 
      b.status === "cancelled" || 
      (b.ride && (b.ride as any).status === "completed") // Check Ride status, not Booking status
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
      return apiRequest("PATCH", `/api/bookings/${bookingId}`, { status });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      const messages = {
        accept: "Booking accepted successfully",
        reject: "Booking rejected",
        cancel: "Booking cancelled",
      };
      toast({
        title: messages[action],
      });
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              ? "When passengers request seats on your rides, they'll appear here."
              : "When you request seats on rides, your bookings will appear here."
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Bookings</h1>
            <p className="text-muted-foreground">
              {activeRole === "driver"
                ? "Manage booking requests from passengers"
                : "Track your ride bookings"}
            </p>
          </div>
          <RoleToggle />
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
              <Clock className="h-4 w-4" />
              Pending ({pendingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="gap-2" data-testid="tab-accepted">
              <Check className="h-4 w-4" />
              Accepted ({acceptedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2" data-testid="tab-past">
              <X className="h-4 w-4" />
              Past ({pastBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {renderBookingsList(pendingBookings)}
          </TabsContent>

          <TabsContent value="accepted">
            {renderBookingsList(acceptedBookings)}
          </TabsContent>

          <TabsContent value="past">
            {renderBookingsList(pastBookings)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!trackingRide} onOpenChange={() => setTrackingRide(null)}>
        <DialogContent className="max-w-3xl h-[80vh] p-0">
          {trackingRide && (
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
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}