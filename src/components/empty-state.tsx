import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils"; // 1. Import class merging utility

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string; // 2. Add optional className prop
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      // 3. Merge the default styles with your custom className
      className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}
      data-testid="empty-state"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} data-testid="button-empty-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}