import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';

const Landing = dynamic(() => import('./landing'), { ssr: false });
const Dashboard = dynamic(() => import('./dashboard'), { ssr: false });

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR, return null to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // On client, use AuthContext to check authentication
  return <HomeContent />;
}

function HomeContent() {
  const { isAuthenticated } = useAuth();
  const content = isAuthenticated ? <Dashboard /> : <Landing />;
  // debug: log the resolved React element to help identify invalid children
  if (typeof window !== 'undefined') {
    try {
      // eslint-disable-next-line no-console
      console.log('HomeContent element:', content);
    } catch (e) {
      // ignore
    }
  }

  return content;
}

