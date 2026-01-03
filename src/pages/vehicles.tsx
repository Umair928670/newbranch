"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { VehicleCard } from "@/components/vehicle-card";
import { EmptyState } from "@/components/empty-state";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Vehicle, InsertVehicle } from "@shared/schema";
import { Plus, Car, Loader2 } from "lucide-react";

const vehicleSchema = z.object({
  model: z.string().min(2, "Model is required"),
  plate: z.string().min(2, "License plate is required"),
  color: z.string().min(2, "Color is required"),
  seats: z.coerce.number().min(1).max(8, "Seats must be between 1 and 8"),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

export default function Vehicles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: [user?.id ? `/api/vehicles?ownerId=${user.id}` : ""],
    enabled: !!user?.id,
  });

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      model: "",
      plate: "",
      color: "",
      seats: 4,
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      return apiRequest("POST", "/api/vehicles", {
        ...data,
        ownerId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [user?.id ? `/api/vehicles?ownerId=${user.id}` : ""] });
      toast({
        title: "Vehicle added",
        description: "Your vehicle has been registered successfully.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add vehicle",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      return apiRequest("PATCH", `/api/vehicles/${editingVehicle?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [user?.id ? `/api/vehicles?ownerId=${user.id}` : ""] });
      toast({
        title: "Vehicle updated",
        description: "Your vehicle has been updated successfully.",
      });
      setDialogOpen(false);
      setEditingVehicle(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update vehicle",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return apiRequest("DELETE", `/api/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [user?.id ? `/api/vehicles?ownerId=${user.id}` : ""] });
      toast({
        title: "Vehicle deleted",
        description: "Your vehicle has been removed.",
      });
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete vehicle",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VehicleFormData) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      model: vehicle.model,
      plate: vehicle.plate,
      color: vehicle.color,
      seats: vehicle.seats,
    });
    setDialogOpen(true);
  };

  const handleDelete = (vehicleId: string) => {
    setVehicleToDelete(vehicleId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (vehicleToDelete) {
      deleteVehicleMutation.mutate(vehicleToDelete);
    }
  };

  const handleAddNew = () => {
    setEditingVehicle(null);
    form.reset({
      model: "",
      plate: "",
      color: "",
      seats: 4,
    });
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Vehicles</h1>
            <p className="text-muted-foreground">
              Manage your registered vehicles for rides
            </p>
          </div>
          <Button onClick={handleAddNew} className="gap-2" data-testid="button-add-vehicle">
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-muted" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 w-32 bg-muted rounded" />
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="flex gap-3">
                        <div className="h-4 w-20 bg-muted rounded" />
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-16 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          <div className="grid gap-6">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={() => handleEdit(vehicle)}
                onDelete={() => handleDelete(vehicle.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Car}
            title="No vehicles registered"
            description="Add your first vehicle to start posting rides as a driver."
            action={{
              label: "Add Vehicle",
              onClick: handleAddNew,
            }}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
            </DialogTitle>
            <DialogDescription>
              {editingVehicle
                ? "Update your vehicle information"
                : "Enter your vehicle details to register it for rides"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Toyota Corolla 2020"
                        {...field}
                        data-testid="input-vehicle-model"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Plate</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., ABC-1234"
                        {...field}
                        data-testid="input-vehicle-plate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., White"
                        {...field}
                        data-testid="input-vehicle-color"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        {...field}
                        data-testid="input-vehicle-seats"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createVehicleMutation.isPending ||
                    updateVehicleMutation.isPending
                  }
                  data-testid="button-save-vehicle"
                >
                  {(createVehicleMutation.isPending ||
                    updateVehicleMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingVehicle ? "Save Changes" : "Add Vehicle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You won't be able to use this vehicle
              for new rides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
