"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Car, Users } from "lucide-react";

export function RoleToggle() {
  const { user, activeRole, setActiveRole } = useAuth();

  if (user?.role !== "both") return null;

  return (
    <div
      className="inline-flex rounded-md bg-muted p-1"
      data-testid="role-toggle"
    >
      <Button
        variant={activeRole === "passenger" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveRole("passenger")}
        className="gap-2"
        data-testid="button-role-passenger"
      >
        <Users className="h-4 w-4" />
        Passenger
      </Button>
      <Button
        variant={activeRole === "driver" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveRole("driver")}
        className="gap-2"
        data-testid="button-role-driver"
      >
        <Car className="h-4 w-4" />
        Driver
      </Button>
    </div>
  );
}
