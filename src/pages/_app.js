import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/header";
import { queryClient } from "@/lib/queryClient";
import { MobileNav } from "@/components/mobile-nav";


export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background">
              <Header />
              <Component {...pageProps} />
              <MobileNav />
            </div>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

