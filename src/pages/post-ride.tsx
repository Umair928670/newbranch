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
    queryKey: [
      user?.id ? `/api/vehicles?ownerId=${user.id}` : ""
    ],
    enabled: !!user?.id,
  });

  // Geocode helper: converts a free-text address to lat/lng using OpenStreetMap Nominatim
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number; displayName: string } | null> => {
    try {
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(address)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  };

  // Reverse geocode: converts lat/lng to a readable place name
  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.displayName || null;
    } catch {
      return null;
    }
  };

  const handleAddressBlur = async (type: "source" | "dest", value: string) => {
    // Only geocode when user entered a non-empty text and lat/lng are not set yet
    if (!value || value.trim().length < 3) return;
    const existingLat = type === "source" ? form.getValues("sourceLat") : form.getValues("destLat");
    const existingLng = type === "source" ? form.getValues("sourceLng") : form.getValues("destLng");
    if (existingLat && existingLng && existingLat !== 0 && existingLng !== 0) return;

    const result = await geocodeAddress(value);
    if (!result) {
      toast({ title: "Location not found", description: "Try a more specific address (e.g., include city and country)", variant: "destructive" });
      return;
    }

    if (type === "source") {
      form.setValue("sourceLat", result.lat, { shouldValidate: true });
      form.setValue("sourceLng", result.lng, { shouldValidate: true });
      form.setValue("sourceAddress", result.displayName);
      toast({ title: "Pickup located", description: `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}` });
    } else {
      form.setValue("destLat", result.lat, { shouldValidate: true });
      form.setValue("destLng", result.lng, { shouldValidate: true });
      form.setValue("destAddress", result.displayName);
      toast({ title: "Dropoff located", description: `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}` });
    }
  };

  const form = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      sourceAddress: "",
      sourceLat: 0,
      sourceLng: 0,
      destAddress: "",
      destLat: 0,
      destLng: 0,
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
      // Ensure relevant ride lists are refreshed immediately after posting
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: [
          `/api/rides?driverId=${user.id}`
        ] });
      }
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

    // Validate that locations are properly set
    if (!data.sourceAddress || data.sourceLat === 0 || data.sourceLng === 0) {
      toast({
        title: "Pickup location required",
        description: "Please enter or select a pickup location",
        variant: "destructive",
      });
      return;
    }

    if (!data.destAddress || data.destLat === 0 || data.destLng === 0) {
      toast({
        title: "Dropoff location required",
        description: "Please enter or select a dropoff location",
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

  const handleMapClick = async (lat: number, lng: number) => {
    // Prefer explicit selection; otherwise, fill whichever is missing first
    const fillSource = selectingLocation === "source" || (!form.getValues("sourceLat") || form.getValues("sourceLat") === 0);
    const fillDest = selectingLocation === "dest" || (!form.getValues("destLat") || form.getValues("destLat") === 0);

    const name = await reverseGeocode(lat, lng);
    const label = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (fillSource && !selectingLocation) {
      // If both missing and no selection, fill source first
      form.setValue("sourceLat", lat);
      form.setValue("sourceLng", lng);
      form.setValue("sourceAddress", label);
      toast({ title: "Pickup location selected", description: label });
    } else if (selectingLocation === "source") {
      form.setValue("sourceLat", lat);
      form.setValue("sourceLng", lng);
      form.setValue("sourceAddress", label);
      toast({ title: "Pickup location selected", description: label });
    } else if (fillDest) {
      form.setValue("destLat", lat);
      form.setValue("destLng", lng);
      form.setValue("destAddress", label);
      toast({ title: "Dropoff location selected", description: label });
    } else {
      // If both already set and no explicit selection, default to updating destination
      form.setValue("destLat", lat);
      form.setValue("destLng", lng);
      form.setValue("destAddress", label);
      toast({ title: "Dropoff location updated", description: label });
    }
    setSelectingLocation(null);
  };

  const sourceLat = form.watch("sourceLat");
  const sourceLng = form.watch("sourceLng");
  const destLat = form.watch("destLat");
  const destLng = form.watch("destLng");

  const mapMarkers = [
    ...(sourceLat && sourceLng && sourceLat !== 0 && sourceLng !== 0 ? [{
      position: [sourceLat, sourceLng] as [number, number],
      label: "Pickup Location",
      type: "source" as const,
    }] : []),
    ...(destLat && destLng && destLat !== 0 && destLng !== 0 ? [{
      position: [destLat, destLng] as [number, number],
      label: "Dropoff Location",
      type: "destination" as const,
    }] : []),
  ];

  const mapRoutes = [
    ...(sourceLat && sourceLng && destLat && destLng &&
      sourceLat !== 0 && sourceLng !== 0 && destLat !== 0 && destLng !== 0 ? [{
        coordinates: [
          [sourceLat, sourceLng] as [number, number],
          [destLat, destLng] as [number, number],
        ],
        color: "#2563eb",
      }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl px-4 py-4 sm:py-6 lg:py-8">

        {/* Header - Responsive */}
        <div className="flex items-center gap-0 mb-2 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="gap-1 h-7 px-2 sm:h-10 sm:px-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-3 w-3" />
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base text-muted-foreground mt-0">
              Back to Dashboard
            </p>
          </div>
        </div>

        {/* Single comprehensive form section */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form - Full width on mobile, left side on desktop */}
            <div className="space-y-6 lg:flex-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-6">
                      <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        <Car className="h-6 w-6 text-primary" />
                        Post Your Ride
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      {/* Route Section */}
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="sourceAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Pickup Location</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    placeholder="Enter pickup location or use map pin"
                                    className={cn(
                                      "h-12 flex-1 text-foreground",
                                      sourceLat && sourceLng && sourceLat !== 0 && sourceLng !== 0
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400"
                                        : ""
                                    )}
                                    {...field}
                                    onBlur={(e) => { field.onBlur(); handleAddressBlur("source", e.target.value); }}
                                    data-testid="input-source-address"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant={selectingLocation === "source" ? "default" : "outline"}
                                  size="icon"
                                  className="h-12 w-12 shrink-0"
                                  onClick={() =>
                                    setSelectingLocation(
                                      selectingLocation === "source" ? null : "source"
                                    )
                                  }
                                  data-testid="button-select-source"
                                >
                                  <MapPin className="h-5 w-5" />
                                </Button>
                              </div>
                              {selectingLocation === "source" && (
                                <p className="text-sm text-primary font-medium mt-2">
                                  📍 Tap on the map above to select pickup location
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
                              <FormLabel className="text-sm font-medium">Dropoff Location</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    placeholder="Enter dropoff location or use map pin"
                                    className={cn(
                                      "h-12 flex-1 text-foreground",
                                      destLat && destLng && destLat !== 0 && destLng !== 0
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400"
                                        : ""
                                    )}
                                    {...field}
                                    onBlur={(e) => { field.onBlur(); handleAddressBlur("dest", e.target.value); }}
                                    data-testid="input-dest-address"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant={selectingLocation === "dest" ? "default" : "outline"}
                                  size="icon"
                                  className="h-12 w-12 shrink-0"
                                  onClick={() =>
                                    setSelectingLocation(
                                      selectingLocation === "dest" ? null : "dest"
                                    )
                                  }
                                  data-testid="button-select-dest"
                                >
                                  <MapPin className="h-5 w-5" />
                                </Button>
                              </div>
                              {selectingLocation === "dest" && (
                                <p className="text-sm text-primary font-medium mt-2">
                                  📍 Tap on the map above to select destination
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {/* Schedule Section */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="departureDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium">Departure Date</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "h-12 justify-start text-left font-normal w-full",
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
                                <FormLabel className="text-sm font-medium">Departure Time</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-11" data-testid="select-time">
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
                        </div>
                      </div>
                      {/* Ride Details Section */}
                      <div className="space-y-4">
                        {vehicles && vehicles.length > 0 && (
                          <FormField
                            control={form.control}
                            name="vehicleId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Vehicle (Optional)</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-11" data-testid="select-vehicle">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <SelectTrigger className="h-11" data-testid="select-seats">
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
                                      className="pl-10 h-11"
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
                        </div>

                        {/* Progress indicator */}
                        <div className="text-sm text-muted-foreground space-y-1">
                          {!sourceLat || !sourceLng || sourceLat === 0 || sourceLng === 0 ? (
                            <p className="text-orange-600">⚠️ Please select a pickup location</p>
                          ) : !destLat || !destLng || destLat === 0 || destLng === 0 ? (
                            <p className="text-orange-600">⚠️ Please select a dropoff location</p>
                          ) : (
                            <p className="text-green-600">✅ All locations selected - ready to post!</p>
                          )}
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
                          size="lg"
                          disabled={createRideMutation.isPending}
                          data-testid="button-post-ride"
                        >
                          {createRideMutation.isPending ? (
                            <>
                              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                              Posting Ride...
                            </>
                          ) : (
                            <>
                              <Car className="mr-3 h-5 w-5" />
                              Post Ride
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Map - Full width on mobile, right side on desktop */}
                  <div className="block lg:w-96">
                    <Card className="h-[400px] lg:h-[600px] lg:sticky lg:top-24 overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Route Preview
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {selectingLocation
                            ? `Tap on map to select ${selectingLocation === "source" ? "pickup" : "dropoff"} location`
                            : mapMarkers.length === 0
                              ? "Click the map pin icons next to address fields to select locations"
                              : "Route preview - click map pin icons to adjust locations"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 h-[calc(100%-5rem)]">
                        <MapComponent
                          center={
                            (sourceLat && sourceLng && destLat && destLng &&
                              sourceLat !== 0 && sourceLng !== 0 && destLat !== 0 && destLng !== 0)
                              ? [(sourceLat + destLat) / 2, (sourceLng + destLng) / 2]
                              : [33.6844, 73.0479] // Default to Islamabad
                          }
                          zoom={
                            (sourceLat && sourceLng && destLat && destLng &&
                              sourceLat !== 0 && sourceLng !== 0 && destLat !== 0 && destLng !== 0)
                              ? 9
                              : 10 // Zoom in more when showing default location
                          }
                          markers={mapMarkers}
                          routes={mapRoutes}
                          onClick={handleMapClick}
                          interactive={true}
                          className="h-full rounded-b-lg"
                        />
                      </CardContent>
                    </Card>
                  </div>
                </form>
              </Form>
            </div>
            {/* Map - Right side on desktop */}
            <div className="hidden lg:block lg:w-96">
              <Card className="h-[400px] lg:h-[600px] lg:sticky lg:top-24 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Route Preview
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {selectingLocation
                      ? `Tap on map to select ${selectingLocation === "source" ? "pickup" : "dropoff"} location`
                      : mapMarkers.length === 0
                        ? "Click the map pin icons next to address fields to select locations"
                        : "Route preview - click map pin icons to adjust locations"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 h-[calc(100%-5rem)]">
                  <MapComponent
                    center={
                      (sourceLat && sourceLng && destLat && destLng &&
                        sourceLat !== 0 && sourceLng !== 0 && destLat !== 0 && destLng !== 0)
                        ? [(sourceLat + destLat) / 2, (sourceLng + destLng) / 2]
                        : [33.6844, 73.0479] // Default to Islamabad
                    }
                    zoom={
                      (sourceLat && sourceLng && destLat && destLng &&
                        sourceLat !== 0 && sourceLng !== 0 && destLat !== 0 && destLng !== 0)
                        ? 9
                        : 10 // Zoom in more when showing default location
                    }
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
    </div>
  );
}
