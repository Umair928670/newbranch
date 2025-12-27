"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"; // Import Sheet components
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { Car, Sun, Moon, User, LogOut, Settings, ArrowLeftRight, Menu } from "lucide-react"; // Import Menu icon
import { useState } from "react";

export function Header() {
  const { user, isAuthenticated, activeRole, switchRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const location = router.pathname;
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const canSwitchRole = user?.role === "both";

  const NavLinks = () => (
    <>
      <Link href="/dashboard" onClick={() => setIsOpen(false)}>
        <Button
          variant={location === "/dashboard" ? "secondary" : "ghost"}
          className="w-full justify-start md:w-auto"
          data-testid="link-dashboard"
        >
          Dashboard
        </Button>
      </Link>
      {(activeRole === "driver" || user?.role === "both") && (
        <Link href="/my-rides" onClick={() => setIsOpen(false)}>
          <Button
            variant={location === "/my-rides" ? "secondary" : "ghost"}
            className="w-full justify-start md:w-auto"
            data-testid="link-my-rides"
          >
            My Rides
          </Button>
        </Link>
      )}
      <Link href="/bookings" onClick={() => setIsOpen(false)}>
        <Button
          variant={location === "/bookings" ? "secondary" : "ghost"}
          className="w-full justify-start md:w-auto"
          data-testid="link-bookings"
        >
          Bookings
        </Button>
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        {/* Mobile Menu Trigger (Left) */}
        {isAuthenticated && (
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80%] sm:w-[350px]">
                <SheetTitle className="text-left mb-4">Menu</SheetTitle>
                <nav className="flex flex-col gap-2 mt-4">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        )}

        <Link href="/" className="flex items-center gap-2 mr-auto md:mr-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold" data-testid="text-logo">
            UniPool
          </span>
        </Link>

        {/* Desktop Navigation */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-1">
            <NavLinks />
          </nav>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex flex-col gap-1 p-2">
                  <p className="text-sm font-medium" data-testid="text-user-name">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {activeRole === "driver" ? "Driver" : "Passenger"}
                    </Badge>
                    {user.cnicStatus === "verified" && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                {canSwitchRole && (
                  <>
                    <DropdownMenuItem onClick={switchRole} data-testid="button-switch-role">
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Switch to {activeRole === "driver" ? "Passenger" : "Driver"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/vehicles")}>
                  <Car className="mr-2 h-4 w-4" />
                  My Vehicles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" data-testid="link-login">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button data-testid="link-signup">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}