"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RideWithDriver } from "@shared/schema";
import { Clock, Users, Calendar, Info, Check, Loader2, Star, Navigation } from "lucide-react";
import { format } from "date-fns";

type RideCardProps = {
  ride: RideWithDriver;
  onBook?: (seats: number) => void;
  onViewDetails?: () => void;
  onTrack?: () => void;
  showBookButton?: boolean;
  compact?: boolean;
  bookingStatus?: string; 
};

export function RideCard({ 
  ride, 
  onBook, 
  onViewDetails,
  onTrack,
  showBookButton = true, 
  compact = false,
  bookingStatus
}: RideCardProps) {
  
  const router = useRouter();
  const [seatsToBook, setSeatsToBook] = useState("1");

  const getInitials = (name: string) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  const departureDate = new Date(ride.departureTime);
  const isValidDate = !isNaN(departureDate.getTime());

  let dateLabel = "Date N/A";
  let timeLabel = "Time N/A";

  if (isValidDate) {
    const isToday = new Date().toDateString() === departureDate.toDateString();
    const isTomorrow = new Date(Date.now() + 86400000).toDateString() === departureDate.toDateString();
    dateLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : format(departureDate, "MMM d");
    timeLabel = format(departureDate, "h:mm a");
  }

  const isPending = bookingStatus === 'pending';
  const isAccepted = bookingStatus === 'accepted';
  const isRejected = bookingStatus === 'rejected';
  
  const isLive = ride.status === 'ongoing';
  const showTrackButton = isAccepted && isLive;

  const seatOptions = Array.from({ length: ride.seatsAvailable }, (_, i) => i + 1);

  // ✅ Extract Driver ID safely
  const driverId = ride.driverId || (ride.driver as any)?._id || (ride.driver as any)?.id;

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md flex flex-col h-full ${compact ? 'text-sm' : ''}`}>
      <CardHeader className={`${compact ? 'p-3 pb-0' : 'p-4 pb-2'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            
            {/* ✅ AVATAR: CLICK TO VIEW PROFILE */}
            <Avatar 
              className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={(e) => {
                e.stopPropagation(); // Stop card click
                if (driverId) router.push(`/user/${driverId}`); // Navigate to /user/:id
              }}
            >
              <AvatarImage src={ride.driver?.avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {getInitials(ride.driver?.name || "U")}
              </AvatarFallback>
            </Avatar>

            <div>
              {/* ✅ NAME: CLICK TO VIEW PROFILE */}
              <p 
                className="font-semibold leading-none cursor-pointer hover:underline hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (driverId) router.push(`/user/${driverId}`);
                }}
              >
                {ride.driver?.name}
              </p>
              {!compact && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {ride.driver?.role === "driver" ? "Driver" : "Verified"}
                  </Badge>
                  <div className="flex items-center text-[10px] text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                    4.8
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className={`font-bold text-primary ${compact ? 'text-base' : 'text-lg'}`}>
              Rs. {ride.costPerSeat}
            </p>
            {!compact && <p className="text-xs text-muted-foreground">per seat</p>}
          </div>
        </div>
      </CardHeader>

      <CardContent className={`${compact ? 'p-3' : 'p-4'} space-y-3 flex-1`}>
        {/* Route Visualization */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-100" />
            <div className="w-0.5 h-full bg-border min-h-[20px] my-0.5" />
            <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100" />
          </div>
          <div className="space-y-3 flex-1">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Pickup</p>
              <p className="font-medium leading-tight line-clamp-1">{ride.sourceAddress}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Dropoff</p>
              <p className="font-medium leading-tight line-clamp-1">{ride.destAddress}</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className={`grid grid-cols-3 gap-2 pt-2 border-t ${compact ? 'text-xs' : 'text-sm'}`}>
          <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className="font-medium">{dateLabel}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className="font-medium">{timeLabel}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-muted/30 rounded-lg">
            <Users className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className={`font-medium ${ride.seatsAvailable === 0 ? 'text-red-500' : ''}`}>
              {ride.seatsAvailable === 0 ? "Full" : `${ride.seatsAvailable} left`}
            </span>
          </div>
        </div>
      </CardContent>

      {showBookButton && (
        <CardFooter className={`${compact ? 'p-3 pt-0' : 'p-4 pt-0'} gap-2`}>
          <Button 
            variant="outline" 
            className="px-3"
            onClick={onViewDetails}
          >
            <Info className="h-4 w-4" />
          </Button>

          {showTrackButton ? (
             <Button 
               className="flex-1 bg-blue-600 hover:bg-blue-700 animate-pulse text-white shadow-sm"
               onClick={onTrack}
             >
               <Navigation className="h-4 w-4 mr-2" /> Track Live
             </Button>
          ) : bookingStatus ? (
             <Button 
               className={`flex-1 font-semibold shadow-sm transition-all
                 ${isAccepted ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                 ${isPending ? "bg-muted text-muted-foreground" : ""}
                 ${isRejected ? "bg-red-100 text-red-600 border border-red-200" : ""}
               `}
               disabled
             >
               {isAccepted ? <><Check className="h-4 w-4 mr-2" /> Accepted</> : 
                isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requested</> : 
                isRejected ? "Declined" : "Booked"}
             </Button>
          ) : ride.seatsAvailable === 0 ? (
            <Button disabled className="flex-1 bg-muted text-muted-foreground">
              No Empty Space
            </Button>
          ) : (
            <div className="flex-1 flex gap-2">
              <div className="w-[70px]">
                <Select value={seatsToBook} onValueChange={setSeatsToBook}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seatOptions.map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                className="flex-1 font-semibold shadow-sm"
                onClick={() => onBook?.(parseInt(seatsToBook))}
              >
                Request
              </Button>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}