"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Vehicle } from "@shared/schema"; 
import {
  User,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  Upload,
  Loader2,
  Car,
  Users,
  ArrowLeftRight,
  Camera,
  ChevronRight
} from "lucide-react";

// --- VALIDATION SCHEMAS ---
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  role: z.enum(["passenger", "driver", "both"]),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const cnicStatusConfig = {
  not_uploaded: { label: "Not Uploaded", icon: Shield, className: "bg-muted text-muted-foreground", description: "Identity not verified" },
  pending: { label: "Pending Review", icon: Clock, className: "bg-yellow-500/10 text-yellow-600", description: "Verification in progress" },
  verified: { label: "Verified", icon: ShieldCheck, className: "bg-green-500/10 text-green-600", description: "Identity verified" },
  rejected: { label: "Rejected", icon: ShieldX, className: "bg-red-500/10 text-red-600", description: "Verification failed" },
};

export default function Profile() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cnicInputRef = useRef<HTMLInputElement>(null);

  // --- 1. PERSONAL INFO FORM ---
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      role: user?.role || "passenger",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PATCH", `/api/users/${user?.id}`, data);
    },
    onSuccess: (updatedUser) => {
      login({ ...user!, ...updatedUser });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  // --- 2. VEHICLE LOGIC ---
  const [vehicleData, setVehicleData] = useState({ model: "", plate: "", color: "" });
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: [`/api/vehicles?ownerId=${user?.id}`],
    enabled: user?.role !== "passenger",
  });

  const saveVehicleMutation = useMutation({
    mutationFn: async (data: typeof vehicleData) => {
      const existingVehicle = vehicles?.[0];
      if (existingVehicle) {
        return apiRequest("PATCH", `/api/vehicles/${existingVehicle.id}`, data);
      } else {
        return apiRequest("POST", "/api/vehicles", { ...data, ownerId: user?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehicle updated successfully" });
    },
  });

  // --- 3. UPLOAD LOGIC ---
  const handleFileUpload = async (file: File, type: "avatar" | "cnic") => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append(type, file);
    const endpoint = type === "avatar" ? "avatar" : "cnic";

    try {
      const response = await fetch(`/api/users/${user?.id}/${endpoint}`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const updatedUser = await response.json();
      login({ ...user!, ...updatedUser });
      toast({ title: "Upload successful", description: type === "avatar" ? "Profile picture updated." : "CNIC submitted." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const cnicStatus = cnicStatusConfig[user?.cnicStatus || "not_uploaded"];
  const CnicIcon = cnicStatus.icon;

  return (
    <div className="min-h-screen bg-muted/5">
      <div className="container px-4 py-10 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile details and preferences.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-8">
          
          {/* --- LEFT SIDEBAR (Refined Design) --- */}
          <aside className="w-full lg:w-72 shrink-0 space-y-6">
            
            {/* Profile Summary Card */}
            <div className="bg-card border rounded-xl p-6 text-center shadow-sm">
              <div 
                className="relative group cursor-pointer w-24 h-24 mx-auto mb-4"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar className="w-full h-full border-4 border-background shadow-md group-hover:opacity-90 transition-opacity">
                  <AvatarImage src={user?.avatar || undefined} className="object-cover" />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                    {getInitials(user?.name || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full border-2 border-background shadow-sm hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                </div>
                <input 
                  type="file" ref={avatarInputRef} className="hidden" accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "avatar")}
                />
              </div>
              
              <h2 className="font-bold text-xl truncate">{user?.name}</h2>
              <p className="text-sm text-muted-foreground truncate mb-4">{user?.email}</p>
              
              <div className="flex justify-center gap-2">
                <Badge variant="outline" className="capitalize px-3 py-1 bg-background">
                  {user?.role === 'both' ? 'Driver & Passenger' : user?.role}
                </Badge>
              </div>
            </div>

            {/* Vertical Menu Navigation */}
            <div className="bg-card border rounded-xl p-2 shadow-sm">
              <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-1 w-full">
                <TabsTrigger 
                  value="personal" 
                  className="w-full justify-between px-4 py-3 data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-lg transition-all font-medium"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4" /> Personal Info
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </TabsTrigger>
                
                {user?.role !== "passenger" && (
                  <>
                    <TabsTrigger 
                      value="vehicle" 
                      className="w-full justify-between px-4 py-3 data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-lg transition-all font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <Car className="h-4 w-4" /> Vehicle Details
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </TabsTrigger>
                    <TabsTrigger 
                      value="verification" 
                      className="w-full justify-between px-4 py-3 data-[state=active]:bg-primary/5 data-[state=active]:text-primary rounded-lg transition-all font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4" /> Verification
                      </div>
                      {user?.cnicStatus === "verified" && (
                        <Badge variant="default" className="bg-green-600 h-5 px-1.5 text-[10px]">Verified</Badge>
                      )}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>
          </aside>

          {/* --- RIGHT CONTENT AREA --- */}
          <div className="flex-1 space-y-6">
            
            {/* TAB 1: PERSONAL INFO */}
            <TabsContent value="personal" className="mt-0 focus-visible:ring-0">
              <Card className="shadow-sm border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Personal Details</CardTitle>
                  <CardDescription>Update your public profile and contact information.</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl><Input {...field} type="tel" placeholder="03XX-XXXXXXX" /></FormControl>
                            <FormDescription>Used for ride coordination only.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="passenger">
                                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground"/> Passenger</div>
                                </SelectItem>
                                <SelectItem value="driver">
                                  <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground"/> Driver</div>
                                </SelectItem>
                                <SelectItem value="both">
                                  <div className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-muted-foreground"/> Both</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-start pt-2">
                        <Button type="submit" disabled={updateProfileMutation.isPending} className="min-w-[120px]">
                          {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: VEHICLE DETAILS */}
            {user?.role !== "passenger" && (
              <TabsContent value="vehicle" className="mt-0 focus-visible:ring-0">
                <Card className="shadow-sm border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Vehicle Information</CardTitle>
                    <CardDescription>Manage the vehicle details shown to passengers.</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6 space-y-4">
                    {vehiclesLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <div className="space-y-6 max-w-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Car Model</label>
                            <Input 
                              placeholder="e.g. Honda Civic"
                              defaultValue={vehicles?.[0]?.model}
                              onChange={(e) => setVehicleData({...vehicleData, model: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Color</label>
                            <Input 
                              placeholder="e.g. White"
                              defaultValue={vehicles?.[0]?.color}
                              onChange={(e) => setVehicleData({...vehicleData, color: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">License Plate</label>
                          <Input 
                            className="uppercase font-mono tracking-wider" 
                            placeholder="ABC-123"
                            defaultValue={vehicles?.[0]?.plate}
                            onChange={(e) => setVehicleData({...vehicleData, plate: e.target.value})}
                          />
                          <p className="text-xs text-muted-foreground">Enter plate number exactly as it appears on your vehicle.</p>
                        </div>
                        <div className="flex justify-start pt-2">
                          <Button onClick={() => saveVehicleMutation.mutate(vehicleData)} disabled={saveVehicleMutation.isPending} className="min-w-[120px]">
                            {saveVehicleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Vehicle
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* TAB 3: VERIFICATION */}
            {user?.role !== "passenger" && (
              <TabsContent value="verification" className="mt-0 focus-visible:ring-0">
                <Card className="shadow-sm border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Identity Verification</CardTitle>
                    <CardDescription>Upload official documents to get the Verified Driver badge.</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    {/* Status Banner */}
                    <div className={`flex items-center gap-4 p-4 rounded-lg border mb-8 ${cnicStatus.className.replace('text-', 'border-').replace('bg-', 'bg-opacity-10 ')}`}>
                      <div className={`p-2.5 rounded-full bg-background shadow-sm`}>
                        <CnicIcon className={`h-6 w-6 ${cnicStatus.className.split(' ')[1]}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{cnicStatus.label}</p>
                        <p className="text-sm text-muted-foreground">{cnicStatus.description}</p>
                      </div>
                    </div>

                    {(user?.cnicStatus === "not_uploaded" || user?.cnicStatus === "rejected") && (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 text-center hover:bg-muted/5 transition-colors">
                        <div className="p-4 bg-primary/5 rounded-full w-fit mx-auto mb-4">
                          <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Upload CNIC Front Side</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                          Please provide a clear photo of your CNIC. Supported formats: JPG, PNG or PDF. Max size: 5MB.
                        </p>
                        
                        <input
                          type="file"
                          ref={cnicInputRef}
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "cnic")}
                          className="hidden"
                        />
                        <Button onClick={() => cnicInputRef.current?.click()} size="lg" className="px-8">
                          <Upload className="mr-2 h-4 w-4" /> Select Document
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

          </div>
        </Tabs>
      </div>
    </div>
  );
}