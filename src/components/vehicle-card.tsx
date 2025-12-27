import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "@shared/schema";
import { Car, Palette, Hash, Users, Pencil, Trash2 } from "lucide-react";

type VehicleCardProps = {
  vehicle: Vehicle;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function VehicleCard({ vehicle, onEdit, onDelete }: VehicleCardProps) {
  return (
    <Card className="overflow-hidden" data-testid={`card-vehicle-${vehicle.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Car className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{vehicle.model}</h3>
              <p className="text-muted-foreground text-sm">
                Your registered vehicle
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{vehicle.plate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>{vehicle.color}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{vehicle.seats} seats</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 border-t bg-muted/30 px-6 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          data-testid={`button-edit-vehicle-${vehicle.id}`}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          data-testid={`button-delete-vehicle-${vehicle.id}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
