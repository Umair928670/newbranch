"use client";

// client/src/pages/user-profile.tsx
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Check imports
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User as UserIcon, Mail, ShieldCheck, Car, Calendar, ArrowLeft, Star, MapPin, MessageCircle, Flag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { User, Review } from "@shared/schema";
import { format } from "date-fns";
import Link from "next/link";

type DriverStats = {
  totalRides: number;
  totalBookings: number;
  averageRating: number;
};

export default function UserProfile() {
  const router = useRouter();
  const userId = router.query.id as string;
  const { toast } = useToast();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DriverStats>({
    queryKey: [`/api/stats/${userId}`],
    enabled: !!userId && (user?.role === "driver" || user?.role === "both"),
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: [`/api/users/${userId}/reviews`],
    enabled: !!userId && (user?.role === "driver" || user?.role === "both"),
  });

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  if (userLoading) return <div className="container p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!user) return <div className="container p-8">User not found</div>;

  return (
    <>
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl px-4 py-0 md:py-8">
          <Link href="/dashboard" aria-label="Back to dashboard">
            <Button variant="ghost" className="gap-2 h-4 md:h-10 mt-3 mb-3 px-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>

        <div className="grid gap-5 md:gap-6">
          {/* Compact Profile Header (Mobile-first) */}
          <Card className="border rounded-xl shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 md:gap-5">
                <Avatar className="h-16 w-16 md:h-24 md:w-24 ring-2 ring-primary/10">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-xl md:text-3xl bg-primary/90 text-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg md:text-2xl font-bold truncate">{user.name}</h1>
                    {(user.role === "driver" || user.role === "both") && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] md:text-xs">
                        <Star className="h-3 w-3 fill-current" /> {stats?.averageRating || "0.0"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize text-[10px] md:text-xs">{user.role}</Badge>
                    {user.cnicStatus === "verified" && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[10px] md:text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                    <span className="hidden md:inline">•</span>
                    <span className="truncate max-w-[160px] md:max-w-[240px] flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {user.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {format(new Date(), "MMM yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats Grid */}
          {(user.role === "driver" || user.role === "both") && (
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <Card className="rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Total Rides</p>
                      <p className="text-xl font-bold">{stats?.totalRides || 0}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Passengers</p>
                      <p className="text-xl font-bold">{stats?.totalBookings || 0}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reviews Section */}
          {(user.role === "driver" || user.role === "both") && (
            <Card className="border rounded-xl shadow-sm">
              <CardHeader className="pb-2 md:pb-4">
                <CardTitle className="text-lg md:text-xl">Passenger Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[55vh] md:h-[400px] pr-3">
                  {reviews && reviews.length > 0 ? (
                    <div className="space-y-4 md:space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-2 items-center">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>P</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">Passenger</p>
                                <p className="text-xs text-muted-foreground">
                                  {review.createdAt ? format(new Date(review.createdAt), "MMM d, yyyy") : "Recent"}
                                </p>
                              </div>
                            </div>
                            <div className="flex text-yellow-500">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-current" />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 pl-10">
                            {review.comment || "No comment provided."}
                          </p>
                          <Separator className="mt-3 md:mt-4" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 md:py-10 text-muted-foreground">
                      <p>No reviews yet.</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    {/* Sticky Contact Action for Mobile */}
    <div className="fixed bottom-24 right-0 z-50 lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="rounded-l-full border-2 text-primary text-gray bg-blue-500 shadow-sm h-10 px-3">Contact</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl p-4">
          <SheetHeader>
            <SheetTitle className="text-base">Contact {user.name}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-3 mt-3">
            <Button className="h-12">
              <MessageCircle className="mr-2 h-4 w-4" /> Message
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </>
  );
}