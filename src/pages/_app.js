"use client";

import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/header";
import { queryClient } from "@/lib/queryClient";
import { MobileNav } from "@/components/mobile-nav";
import { AblyProvider } from "@/components/ably-provider";
import { useRouter } from "next/router";

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const isChatPage = router.pathname.startsWith('/chat');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Component {...pageProps} />
      {!isChatPage && <MobileNav />}
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AblyProvider />
          <TooltipProvider>
            <AppContent Component={Component} pageProps={pageProps} />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

