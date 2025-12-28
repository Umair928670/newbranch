"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BookingWithDetails } from "@shared/schema";
import { 
  Clock, 
  Users, 
  Banknote, 
  Calendar, 
  Check, 
  X, 
  Navigation, 
  Star, 
  FileText, 
  MessageCircle, 
  Ban 
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BookingCardProps = {
  booking: BookingWithDetails;
  viewAs: "passenger" | "driver" | string;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onTrack?: () => void;
  onViewDetails?: () => void;
};

// Base config for standard booking statuses
const statusConfig: any = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  accepted: { label: "Accepted", className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
};

export function BookingCard({
  booking,
  viewAs,
  onAccept,
  onReject,
  onCancel,
  onTrack,
  onViewDetails
}: BookingCardProps) {
  const { toast } = useToast();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [hasReviewed, setHasReviewed] = useState(!!booking.review);

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

  // --- SMART STATUS LOGIC ---
  const isRideCompleted = ride.status === "completed";
  const isLive = ride.status === "ongoing";
  const isAccepted = booking.status === "accepted";
  const isPending = booking.status === "pending";

  // Determine what visual style to use
  let activeStatus = statusConfig[booking.status] || statusConfig.pending;
  let borderColor = '#f59e0b'; // Default Amber

  if (booking.status === 'rejected') borderColor = '#ef4444';
  else if (booking.status === 'cancelled') borderColor = '#94a3b8';
  else if (isRideCompleted && isAccepted) {
    // Override for Completed Rides
    activeStatus = { label: "Completed", className: "bg-blue-500/10 text-blue-700 border-blue-200" };
    borderColor = '#3b82f6';
  } else if (isAccepted) {
    borderColor = '#10b981';
  }

  const departureDate = new Date(ride.departureTime);
  const isToday = new Date().toDateString() === departureDate.toDateString();
  const dateLabel = isToday ? "Today" : format(departureDate, "MMM d");

  // Determine User to Display
  let displayUser = viewAs === "driver" ? passenger : null;
  if (viewAs !== "driver") {
    if (ride.driver && typeof ride.driver === 'object') displayUser = ride.driver;
    else if (ride.driverId && typeof ride.driverId === 'object') displayUser = ride.driverId;
    else if (booking.driver && typeof booking.driver === 'object') displayUser = booking.driver;
  }
  const userLabel = viewAs === "driver" ? "Passenger" : "Driver";

  // --- REVIEW MUTATION ---
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const rideIdStr = getId(ride);
      const reviewerIdStr = getId(passenger);
      let revieweeIdStr = getId(ride.driverId);
      
      if (!revieweeIdStr && ride.driver) revieweeIdStr = getId(ride.driver);
      if (!revieweeIdStr && booking.driver) revieweeIdStr = getId(booking.driver);

      if (!rideIdStr || !reviewerIdStr || !revieweeIdStr) throw new Error("Missing ID info");

      return apiRequest("POST", "/api/reviews", {
        rideId: rideIdStr,
        reviewerId: reviewerIdStr,
        revieweeId: revieweeIdStr,
        rating: parseInt(rating),
        comment: comment || "",
      });
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Thanks for feedback!" });
      setRatingOpen(false);
      setHasReviewed(true);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return (
    <>
      <Card 
        className="overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-all border-l-[6px] group bg-card"
        style={{ borderLeftColor: borderColor }}
      >
        {/* HEADER */}
        <CardHeader className="pb-3 pt-4 px-4 bg-muted/5 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                <AvatarImage src={displayUser?.avatar || undefined} />
                <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                  {getInitials(displayUser?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">{userLabel}</p>
                <p className="font-bold truncate max-w-[140px] text-sm leading-tight">{displayUser?.name || "Unknown"}</p>
                {viewAs !== "driver" && ride.vehicle && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{ride.vehicle.model} • {ride.vehicle.color}</p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 border-none font-medium", activeStatus.className)}>
                {activeStatus.label}
              </Badge>
              {isLive && isAccepted && (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-green-600">LIVE</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {/* CONTENT */}
        <CardContent className="space-y-4 pt-4 px-4 flex-1">
          {/* Timeline */}
          <div className="relative pl-2">
             <div className="absolute left-[5px] top-[7px] bottom-[20px] w-0.5 bg-gradient-to-b from-emerald-500/50 to-rose-500/50" />
             <div className="space-y-4">
                <div className="flex gap-3 relative">
                   <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-card z-10 mt-1" />
                   <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Pickup</p>
                      <p className="text-xs font-medium line-clamp-1">{ride.sourceAddress}</p>
                   </div>
                </div>
                <div className="flex gap-3 relative">
                   <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-card z-10 mt-1" />
                   <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Dropoff</p>
                      <p className="text-xs font-medium line-clamp-1">{ride.destAddress}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-px bg-border/40 rounded-lg overflow-hidden border">
            <div className="bg-muted/10 p-2.5 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{dateLabel}</span>
            </div>
            <div className="bg-muted/10 p-2.5 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{format(departureDate, "h:mm a")}</span>
            </div>
            <div className="bg-muted/10 p-2.5 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{booking.seatsBooked} Seat(s)</span>
            </div>
            <div className="bg-muted/10 p-2.5 flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Rs. {ride.costPerSeat * booking.seatsBooked}</span>
            </div>
          </div>
        </CardContent>

        {/* --- FOOTER: ACTION BAR --- */}
        <CardFooter className="pt-0 pb-0 px-0 mt-auto border-t bg-muted/5">
          {viewAs === "driver" ? (
             /* DRIVER ACTIONS */
             <div className="flex w-full p-3 gap-2">
               {isPending ? (
                 <>
                   <Button variant="outline" size="sm" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-9" onClick={onReject}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                   </Button>
                   <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-9" onClick={onAccept}>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Accept
                   </Button>
                 </>
               ) : (
                 <Link href={`/chat/${getId(booking)}`} className="w-full">
                    <Button variant="secondary" className="w-full h-9 muted/10 border shadow-sm">
                       <MessageCircle className="mr-2 h-4 w-4 text-blue-500" /> Chat with Passenger
                    </Button>
                 </Link>
               )}
             </div>
          ) : (
             /* PASSENGER ACTIONS (4 Icons Grid) */
             <div className="grid grid-cols-4 w-full divide-x divide-border/50">
               
               {/* 1. Detail */}
               <Button 
                  variant="ghost" 
                  className="flex flex-col gap-1 h-14 rounded-none hover:bg-muted/50" 
                  onClick={onViewDetails}
               >
                  <FileText className="h-4 w-4 text-foreground/70" />
                  <span className="text-[10px] font-medium text-muted-foreground">Detail</span>
               </Button>

               {/* 2. Cancel */}
               <Button 
                  variant="ghost" 
                  className="flex flex-col gap-1 h-14 rounded-none hover:bg-red-50 hover:text-red-600 disabled:opacity-30" 
                  onClick={onCancel}
                  disabled={!isPending && !(isAccepted && !isLive && !isRideCompleted)}
               >
                  <Ban className={cn("h-4 w-4", (isPending || (isAccepted && !isLive && !isRideCompleted)) ? "text-red-500" : "text-muted-foreground")} />
                  <span className={cn("text-[10px] font-medium", (isPending || (isAccepted && !isLive && !isRideCompleted)) ? "text-red-500" : "text-muted-foreground")}>Cancel</span>
               </Button>

               {/* 3. Chat */}
               <Link href={isAccepted ? `/chat/${getId(booking)}` : "#"} className={cn("flex-1", !isAccepted && "pointer-events-none")}>
                  <Button 
                    variant="ghost" 
                    className="flex flex-col gap-1 h-14 w-full rounded-none hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30" 
                    disabled={!isAccepted}
                  >
                    <MessageCircle className={cn("h-4 w-4", isAccepted ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px] font-medium", isAccepted ? "text-blue-500" : "text-muted-foreground")}>Chat</span>
                  </Button>
               </Link>

               {/* 4. Live / Review */}
               {isRideCompleted && isAccepted ? (
                 <Button 
                    variant="ghost" 
                    className="flex flex-col gap-1 h-14 rounded-none hover:bg-yellow-50 hover:text-yellow-600"
                    onClick={() => !hasReviewed && setRatingOpen(true)}
                    disabled={hasReviewed}
                 >
                    {hasReviewed ? <Check className="h-4 w-4 text-green-500" /> : <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    <span className="text-[10px] font-medium text-foreground">{hasReviewed ? "Done" : "Review"}</span>
                 </Button>
               ) : (
                 <Button 
                    variant="ghost" 
                    className={cn(
                      "flex flex-col gap-1 h-14 rounded-none transition-colors", 
                      isLive ? "hover:bg-green-50 hover:text-green-600 animate-pulse bg-green-50/30" : "hover:bg-muted/50 disabled:opacity-30"
                    )}
                    onClick={onTrack}
                    disabled={!isLive}
                 >
                    <Navigation className={cn("h-4 w-4", isLive ? "text-green-600" : "text-muted-foreground")} />
                    <span className={cn("text-[10px] font-medium", isLive ? "text-green-600 font-bold" : "text-muted-foreground")}>
                      {isLive ? "Track" : "Live"}
                    </span>
                 </Button>
               )}
             </div>
          )}
        </CardFooter>
      </Card>

      {/* Review Dialog */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent className="w-[90%] rounded-xl">
          <DialogHeader><DialogTitle>Rate Your Driver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Rating</Label>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 hover:bg-transparent"
                    onClick={() => setRating(star.toString())}
                  >
                    <Star className={cn("h-8 w-8 transition-all", parseInt(rating) >= star ? "fill-yellow-400 text-yellow-400 scale-110" : "text-muted-foreground/30")} />
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Comment (Optional)</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the ride? Was the driver punctual?"
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => submitReviewMutation.mutate()} disabled={submitReviewMutation.isPending} className="w-full bg-primary">
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}