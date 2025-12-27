"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { MapComponent } from "@/components/map-component";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Vehicle, InsertRide } from "@shared/schema";
import {
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Banknote,
  Car,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const rideSchema = z.object({
  sourceAddress: z.string().min(5, "Please enter a valid pickup address"),
  sourceLat: z.number(),
  sourceLng: z.number(),
  destAddress: z.string().min(5, "Please enter a valid destination address"),
  destLat: z.number(),
  destLng: z.number(),
  departureDate: z.date({ required_error: "Please select a date" }),
  departureTime: z.string().min(1, "Please select a time"),
  seatsTotal: z.coerce.number().min(1).max(8),
  costPerSeat: z.coerce.number().min(50, "Minimum Rs. 50 per seat"),
  vehicleId: z.string().optional(),
});

type RideFormData = z.infer<typeof rideSchema>;

const timeSlots = [
  "05:00", "05:30", "06:00", "06:30", "07:00", "07:30",
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00",
];

const defaultLocations = {
  pindiGheb: {
    lat: 33.2451,
    lng: 72.4192,
    address: "Pindi Gheb, Punjab, Pakistan",
  },
  university: {
    lat: 33.6844,
    lng: 73.0479,
    address: "University Campus, Islamabad",
  },
};

export default function PostRide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [selectingLocation, setSelectingLocation] = useState<"source" | "dest" | null>(null);

  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles", user?.id],
    enabled: !!user?.id,
  });

  const form = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      sourceAddress: defaultLocations.pindiGheb.address,
      sourceLat: defaultLocations.pindiGheb.lat,
      sourceLng: defaultLocations.pindiGheb.lng,
      destAddress: defaultLocations.university.address,
      destLat: defaultLocations.university.lat,
      destLng: defaultLocations.university.lng,
      departureDate: new Date(),
      departureTime: "07:00",
      seatsTotal: 3,
      costPerSeat: 300,
      vehicleId: "",
    },
  });

  const createRideMutation = useMutation({
    mutationFn: async (data: InsertRide) => {
      const res = await apiRequest("POST", "/api/rides", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      toast({
        title: "Ride posted!",
        description: "Your ride is now visible to passengers.",
      });
      router.push("/my-rides");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to post ride",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RideFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to post a ride",
        variant: "destructive",
      });
      return;
    }

    // 1. Combine Date and Time
    const departureDateTime = new Date(data.departureDate);
    const [hours, minutes] = data.departureTime.split(':').map(Number);
    departureDateTime.setHours(hours, minutes);

    // 2. Transform form data to match API schema (InsertRide)
    const rideData: InsertRide = {
      sourceAddress: data.sourceAddress,
      sourceLat: data.sourceLat,
      sourceLng: data.sourceLng,
      destAddress: data.destAddress,
      destLat: data.destLat,
      destLng: data.destLng,
      costPerSeat: data.costPerSeat,
      seatsTotal: data.seatsTotal,
      // Set calculated/required fields:
      departureTime: departureDateTime,
      driverId: user.id, // Add the logged-in user's ID
      seatsAvailable: data.seatsTotal, // Initially, available = total
      vehicleId: data.vehicleId || undefined, // Handle empty string as undefined
    };

    createRideMutation.mutate(rideData);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (selectingLocation === "source") {
      form.setValue("sourceLat", lat);
      form.setValue("sourceLng", lng);
      form.setValue("sourceAddress", `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } else if (selectingLocation === "dest") {
      form.setValue("destLat", lat);
      form.setValue("destLng", lng);
      form.setValue("destAddress", `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
    setSelectingLocation(null);
  };

  const sourceLat = form.watch("sourceLat");
  const sourceLng = form.watch("sourceLng");
  const destLat = form.watch("destLat");
  const destLng = form.watch("destLng");

  const mapMarkers = [
    {
      position: [sourceLat, sourceLng] as [number, number],
      label: "Pickup Location",
      type: "source" as const,
    },
    {
      position: [destLat, destLng] as [number, number],
      label: "Dropoff Location",
      type: "destination" as const,
    },
  ];

  const mapRoutes = [
    {
      coordinates: [
        [sourceLat, sourceLng] as [number, number],
        [destLat, destLng] as [number, number],
      ],
      color: "#2563eb",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Post a New Ride</h1>
          <p className="text-muted-foreground">
            Share your journey and connect with passengers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Form {...form}>
              {/* ... form content remains same ... */}
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 {/* ... Cards for Route, Schedule, Ride Details ... */}
                 {/* (Content matches original file) */}
                 <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Route Details
                    </CardTitle>
                    <CardDescription>
                      Click the map or enter addresses manually
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="sourceAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pickup Location</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter pickup address"
                                {...field}
                                data-testid="input-source-address"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant={selectingLocation === "source" ? "default" : "outline"}
                              size="icon"
                              onClick={() =>
                                setSelectingLocation(
                                  selectingLocation === "source" ? null : "source"
                                )
                              }
                              data-testid="button-select-source"
                            >
                              <MapPin className="h-4 w-4" />
                            </Button>
                          </div>
                          {selectingLocation === "source" && (
                            <p className="text-sm text-primary">
                              Click on the map to select pickup location
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dropoff Location</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter destination address"
                                {...field}
                                data-testid="input-dest-address"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant={selectingLocation === "dest" ? "default" : "outline"}
                              size="icon"
                              onClick={() =>
                                setSelectingLocation(
                                  selectingLocation === "dest" ? null : "dest"
                                )
                              }
                              data-testid="button-select-dest"
                            >
                              <MapPin className="h-4 w-4" />
                            </Button>
                          </div>
                          {selectingLocation === "dest" && (
                            <p className="text-sm text-primary">
                              Click on the map to select destination
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="departureDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Departure Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-date-picker"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departureTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departure Time</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-time">
                                <Clock className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeSlots.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {format(
                                    new Date(`2000-01-01T${time}`),
                                    "h:mm a"
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Ride Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {vehicles && vehicles.length > 0 && (
                      <FormField
                        control={form.control}
                        name="vehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle (Optional)</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-vehicle">
                                  <SelectValue placeholder="Select a vehicle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicles.map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id}>
                                    {vehicle.model} - {vehicle.plate}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="seatsTotal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Available Seats</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-seats">
                                <Users className="mr-2 h-4 w-4" />
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6].map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num} seat{num > 1 ? "s" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="costPerSeat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost per Seat (PKR)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={50}
                                className="pl-10"
                                {...field}
                                data-testid="input-cost"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Recommended: Rs. 200-500 based on distance
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={createRideMutation.isPending}
                  data-testid="button-post-ride"
                >
                  {createRideMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Post Ride
                </Button>
              </form>
            </Form>
          </div>
          
          {/* UPDATED: Map visible on mobile, appropriate height */}
          <div className="block mt-8 lg:mt-0"> 
            <Card className="h-[400px] lg:h-[600px] lg:sticky lg:top-24 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Route Preview</CardTitle>
                <CardDescription>
                  {selectingLocation
                    ? `Click to select ${selectingLocation === "source" ? "pickup" : "dropoff"} location`
                    : "Visualize your ride route"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-5rem)]">
                <MapComponent
                  center={[(sourceLat + destLat) / 2, (sourceLng + destLng) / 2]}
                  zoom={9}
                  markers={mapMarkers}
                  routes={mapRoutes}
                  onClick={handleMapClick}
                  interactive={true}
                  className="h-full rounded-b-lg"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
