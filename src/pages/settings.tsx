"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme-provider";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Moon, Sun, Laptop, Bell, Shield, Trash2, KeyRound, Loader2 } from "lucide-react";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, login, logout } = useAuth();
  const { toast } = useToast();

  // Local state for toggles to ensure instant UI feedback
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [marketingNotifs, setMarketingNotifs] = useState(false);

  // Sync local state with user data when it loads
  useEffect(() => {
    if (user) {
      setEmailNotifs(user.emailNotifications ?? true);
      setPushNotifs(user.pushNotifications ?? true);
      setMarketingNotifs(user.marketingNotifications ?? false);
    }
  }, [user]);

  // --- 1. NOTIFICATIONS LOGIC ---
  const updateNotifMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/users/${user?.id}`, data);
    },
    onSuccess: (updatedUser) => {
      login({ ...user!, ...updatedUser }); // Update Global Context
      // Toast optional: removed to be less annoying
    },
    onError: () => {
      toast({ title: "Failed to save preference", variant: "destructive" });
      // Revert toggles if failed
      if (user) {
        setEmailNotifs(user.emailNotifications ?? true);
        setPushNotifs(user.pushNotifications ?? true);
        setMarketingNotifs(user.marketingNotifications ?? false);
      }
    }
  });

  const handleToggle = (key: string, val: boolean, setFn: (v: boolean) => void) => {
    setFn(val); // Optimistic UI update
    updateNotifMutation.mutate({ [key]: val });
  };

  // --- 2. PASSWORD CHANGE LOGIC ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      // ✅ CUSTOM FETCH: To handle the 400 error message manually
      const res = await fetch(`/api/users/${user?.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ✅ THROW THE EXACT SERVER MESSAGE
        throw new Error(data.message || "Failed to update password");
      }
      
      return data;
    },
    onSuccess: () => {
      toast({ title: "Password updated successfully", className: "bg-green-600 text-white" });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error: any) => {
      // ✅ FIX: Show ONLY the error message text
      const msg = error.message || "Something went wrong";
      toast({ 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ description: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  };

  // --- 3. DELETE ACCOUNT LOGIC ---
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/users/${user?.id}`);
    },
    onSuccess: () => {
      logout();
    },
    onError: (error: any) => {
      toast({ description: error.message || "Failed to delete account", variant: "destructive" });
    }
  });

  return (
    <div className="min-h-screen bg-muted/5">
      <div className="container max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your app preferences and account security.</p>
        </div>

        <div className="grid gap-8">
          
          {/* --- APPEARANCE --- */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                <CardTitle>Appearance</CardTitle>
              </div>
              <CardDescription>Customize how the app looks on your device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Theme Preference</Label>
                  <p className="text-sm text-muted-foreground">Select your preferred color theme.</p>
                </div>
                <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="h-4 w-4"/> Light</div></SelectItem>
                    <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="h-4 w-4"/> Dark</div></SelectItem>
                    <SelectItem value="system"><div className="flex items-center gap-2"><Laptop className="h-4 w-4"/> System</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* --- NOTIFICATIONS --- */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive booking confirmations via email.</p>
                </div>
                <Switch 
                  checked={emailNotifs} 
                  onCheckedChange={(val) => handleToggle("emailNotifications", val, setEmailNotifs)} 
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive real-time updates about ride status.</p>
                </div>
                <Switch 
                  checked={pushNotifs} 
                  onCheckedChange={(val) => handleToggle("pushNotifications", val, setPushNotifs)} 
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Marketing & Tips</Label>
                  <p className="text-sm text-muted-foreground">Receive carpooling tips and news.</p>
                </div>
                <Switch 
                  checked={marketingNotifs} 
                  onCheckedChange={(val) => handleToggle("marketingNotifications", val, setMarketingNotifs)} 
                />
              </div>
            </CardContent>
          </Card>

          {/* --- SECURITY --- */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Update your password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input 
                    id="current-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" className="mt-2" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* --- DANGER ZONE --- */}
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <CardTitle>Danger Zone</CardTitle>
              </div>
              <CardDescription>Irreversible actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account, rides, and history.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your data including rides, bookings, and vehicle information will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteAccountMutation.mutate()} 
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deleteAccountMutation.isPending ? "Deleting..." : "Yes, delete my account"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground pb-8">
            <p>UniPool v1.0.0</p>
            <p>Made with ❤️ for students</p>
          </div>

        </div>
      </div>
    </div>
  );
}