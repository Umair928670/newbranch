"use client";

// client/src/pages/user-profile.tsx
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Check imports
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User as UserIcon, Mail, ShieldCheck, Car, Calendar, ArrowLeft, Star, MapPin
} from "lucide-react";
import type { User, Review } from "@shared/schema";
import { format } from "date-fns";
import Link from "next/link";

type DriverStats = {
  totalRides: number;
  totalBookings: number;
  totalEarnings: number;
  activeRides: number;
  averageRating: number;
};

export default function UserProfile() {
  const router = useRouter();
  const userId = router.query.id as string;

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
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>

        <div className="grid gap-6">
          {/* Main Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <Avatar className="h-32 w-32 border-4 border-primary/10">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center md:text-left flex-1 space-y-3">
                  <div>
                    <h1 className="text-3xl font-bold">{user.name}</h1>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                      <Badge variant="secondary" className="capitalize">
                        {user.role}
                      </Badge>
                      {user.cnicStatus === "verified" && (
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {user.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Member since {format(new Date(), "MMM yyyy")}
                    </div>
                  </div>
                </div>

                {/* Rating Box */}
                {(user.role === "driver" || user.role === "both") && (
                  <div className="bg-primary/5 p-6 rounded-xl text-center min-w-[150px]">
                    <div className="flex justify-center items-center gap-1 text-yellow-500 mb-1">
                      <Star className="fill-current h-6 w-6" />
                      <span className="text-3xl font-bold text-foreground">
                        {stats?.averageRating || "0.0"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {reviews?.length || 0} reviews
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Stats Grid */}
          {(user.role === "driver" || user.role === "both") && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Rides" value={stats?.totalRides || 0} icon={Car} />
              <StatCard title="Active Rides" value={stats?.activeRides || 0} icon={MapPin} />
              <StatCard title="Passengers" value={stats?.totalBookings || 0} icon={UserIcon} />
              <StatCard title="Experience" value="New" icon={ShieldCheck} />
            </div>
          )}

          {/* Reviews Section */}
          {(user.role === "driver" || user.role === "both") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Passenger Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {reviews && reviews.length > 0 ? (
                    <div className="space-y-6">
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
                          <Separator className="mt-4" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
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
  );
}