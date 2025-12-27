"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";
import { Home, Search, Car, User, PlusCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const pathname = router.pathname;

  // 1. Hide on public pages (Login, Signup, Landing)
  if (["/login", "/signup", "/"].includes(pathname)) return null;

  // 2. Hide if user is not logged in
  if (!user) return null;

  const navItems = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/bookings", label: "Bookings", icon: Search },
    // Center Button: Post Ride (Driver) or Find Ride (Passenger)
    { 
      href: "/post-ride", 
      label: "Post", 
      icon: PlusCircle, 
      primary: true,
      show: activeRole === 'driver' 
    },
    { href: "/my-rides", label: "My Rides", icon: Car },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border pb-safe md:hidden shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          // Skip if 'show' is strictly false
          if (item.show === false) return null;

          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          // Special "Primary" Button Style (Center)
          if (item.primary) {
            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center justify-center -mt-8 relative group">
                  <div className="h-14 w-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95">
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <span className="text-[10px] font-semibold mt-1 text-muted-foreground group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center py-1 gap-0.5 transition-colors active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
              )}>
                <Icon className={cn("h-6 w-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}