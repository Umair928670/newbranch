"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BookingWithDetails } from "@shared/schema";
import { MapPin, Clock, Users, Banknote, Calendar, Check, X, Navigation, Star, ArrowRight, Ban } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

type BookingCardProps = {
  booking: BookingWithDetails;
  viewAs: "passenger" | "driver" | string;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onTrack?: () => void;
};

const statusConfig: any = {
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200" },
  accepted: { label: "Accepted", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-gray-200" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200" }
};

export function BookingCard({
  booking,
  viewAs,
  onAccept,
  onReject,
  onCancel,
  onTrack,
}: BookingCardProps) {
  const { toast } = useToast();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(!!booking.review);

  // Helper to extract ID string safely from populated objects or raw strings
  const getId = (item: any) => {
    if (!item) return undefined;
    if (typeof item === 'string') return item;
    return item.id || item._id;
  };

  const ride: any = booking.ride || booking.rideId;
  const passenger: any = booking.passenger || booking.passengerId;

  if (!ride || !ride.departureTime) return null;

  const getInitials = (name: string) => {
    return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";
  };

  const status = statusConfig[booking.status] || statusConfig.pending;
  const departureDate = new Date(ride.departureTime);
  const isToday = new Date().toDateString() === departureDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === departureDate.toDateString();
  const dateLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : format(departureDate, "MMM d");

  // Determine which user to display on the card
  // If viewing as Driver -> Show Passenger
  // If viewing as Passenger -> Show Driver (which might be nested in ride.driverId due to population)
  let displayUser = viewAs === "driver" ? passenger : null;

  if (viewAs !== "driver") {
    // Try to find the driver object. 
    // It might be 'ride.driver' (custom object) or 'ride.driverId' (populated object)
    if (ride.driver && typeof ride.driver === 'object') {
      displayUser = ride.driver;
    } else if (ride.driverId && typeof ride.driverId === 'object') {
      displayUser = ride.driverId;
    } else if (booking.driver && typeof booking.driver === 'object') {
      displayUser = booking.driver;
    }
  }

  const userLabel = viewAs === "driver" ? "Passenger" : "Driver";
  const isLive = ride.status === "ongoing";
  const isCompleted = ride.status === "completed";

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      // ✅ FIX: Extract IDs safely to ensure strings are sent, not objects
      const rideIdStr = getId(ride);
      const reviewerIdStr = getId(passenger);

      // Determine driver ID (Reviewee)
      let revieweeIdStr = getId(ride.driverId);
      if (!revieweeIdStr && ride.driver) revieweeIdStr = getId(ride.driver);
      if (!revieweeIdStr && booking.driver) revieweeIdStr = getId(booking.driver);

      if (!rideIdStr || !reviewerIdStr || !revieweeIdStr) {
        throw new Error("Missing ID information for review");
      }

      return apiRequest("POST", "/api/reviews", {
        rideId: rideIdStr,
        reviewerId: reviewerIdStr,
        revieweeId: revieweeIdStr,
        rating: parseInt(rating),
        comment: comment || "", // Ensure string
      });
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Thanks for feedback!" });
      setRatingOpen(false);
      setHasReviewed(true);
    },
    onError: (error: any) => {
      console.error("Review Error:", error);
      toast({ title: "Error", description: error.message || "Failed to submit review", variant: "destructive" });
    }
  });

  return (
    <>
      <Card className="overflow-hidden flex flex-col h-full hover:shadow-md transition-all border-l-4"
        style={{ borderLeftColor: booking.status === 'accepted' ? '#22c55e' : booking.status === 'rejected' ? '#ef4444' : '#eab308' }}
        data-testid={`card-booking-${booking.id}`}>

        <CardHeader className="pb-3 bg-muted/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-background">
                <AvatarImage src={displayUser?.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(displayUser?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{userLabel}</p>
                <p className="font-semibold truncate max-w-[120px]">{displayUser?.name || "Unknown"}</p>
                {viewAs !== "driver" && ride.vehicle && (
                  <p className="text-xs text-muted-foreground">{ride.vehicle.model} • {ride.vehicle.color}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
              {isLive && booking.status === 'accepted' && <Badge className="bg-green-600 text-white animate-pulse">LIVE</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 flex-1">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="w-0.5 h-full bg-border min-h-[24px] my-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Pickup</p>
                  <p className="font-medium text-sm leading-tight line-clamp-1">{ride.sourceAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Dropoff</p>
                  <p className="font-medium text-sm leading-tight line-clamp-1">{ride.destAddress}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div className="bg-muted/30 p-2 rounded flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{dateLabel}</span>
            </div>
            <div className="bg-muted/30 p-2 rounded flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{format(departureDate, "h:mm a")}</span>
            </div>
            <div className="bg-muted/30 p-2 rounded flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{booking.seatsBooked} seat(s)</span>
            </div>
            <div className="bg-muted/30 p-2 rounded flex items-center gap-2 font-semibold">
              <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Rs. {ride.costPerSeat * booking.seatsBooked}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 pt-0 pb-4 px-4">
          {viewAs === "driver" && booking.status === "pending" && (
            <>
              <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={onReject}>
                <X className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onAccept}>
                <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
            </>
          )}

          {viewAs !== "driver" && (
            <>
              {(booking.status === "pending" || (booking.status === "accepted" && !isLive && !isCompleted)) && (
                <Button variant="outline" className="w-full" onClick={onCancel}>
                  <Ban className="mr-2 h-4 w-4" /> Cancel Request
                </Button>
              )}

              {booking.status === "accepted" && isLive && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700 animate-pulse" onClick={onTrack}>
                  <Navigation className="mr-2 h-4 w-4" /> Track Live
                </Button>
              )}
              {booking.status === "accepted" && (
                <Link href={`/chat/${booking.id}`} className="w-full">
                  <Button variant="secondary" className="w-full mb-2">
                    <MessageCircle className="mr-2 h-4 w-4" /> Chat
                  </Button>
                </Link>
              )}
              {booking.status === "accepted" && isCompleted && (
                <Button
                  className="w-full"
                  variant={hasReviewed ? "outline" : "secondary"}
                  onClick={() => !hasReviewed && setRatingOpen(true)}
                  disabled={hasReviewed}
                >
                  {hasReviewed ? (
                    <> <Check className="mr-2 h-4 w-4" /> Reviewed </>
                  ) : (
                    <> <Star className="mr-2 h-4 w-4" /> Rate Driver </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>

      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rate Driver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ (Excellent)</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ (Good)</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ (Average)</SelectItem>
                  <SelectItem value="2">⭐⭐ (Poor)</SelectItem>
                  <SelectItem value="1">⭐ (Terrible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Comment</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the ride? Was the driver punctual?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => submitReviewMutation.mutate()} disabled={submitReviewMutation.isPending}>
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}