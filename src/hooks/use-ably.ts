"use client";

import { useEffect, useRef } from 'react';
import * as Ably from 'ably';
import { useAuth } from '@/lib/auth-context';
import { queryClient } from '@/lib/queryClient';

export function useAbly() {
  const { user } = useAuth();
  const ablyRef = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    if (!user) return;

    const initAbly = async () => {
      try {
        // Get token from API
        const res = await fetch(`/api/auth/ably?userId=${user.id}`);
        if (!res.ok) throw new Error('Failed to get Ably token');
        const tokenRequest = await res.json();

        // Initialize Ably client
        const client = new Ably.Realtime({
          authCallback: (tokenParams, callback) => callback(null, tokenRequest)
        });

        ablyRef.current = client;

        // Subscribe to user-specific channel
        const userChannel = client.channels.get(`user:${user.id}`);
        userChannel.subscribe((message) => {
          console.log('Received Ably message:', message.name, message.data);

          // Handle different message types
          switch (message.name) {
            case 'ride.created':
            case 'ride.updated':
            case 'ride.cancelled':
              // Invalidate rides queries
              queryClient.invalidateQueries({ queryKey: ['rides'] });
              queryClient.invalidateQueries({ queryKey: ['my-rides'] });
              break;
            case 'booking.created':
            case 'booking.updated':
              // Invalidate bookings queries
              queryClient.invalidateQueries({ queryKey: ['bookings'] });
              queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
              break;
            case 'message':
              // Could invalidate chat queries if implemented
              break;
          }
        });

        // Subscribe to role-specific channels
        if (user.role === 'driver' || user.role === 'both') {
          const driverChannel = client.channels.get(`driver:${user.id}`);
          driverChannel.subscribe((message) => {
            console.log('Driver message:', message.name, message.data);
            queryClient.invalidateQueries({ queryKey: ['my-rides'] });
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
          });
        }

        if (user.role === 'passenger' || user.role === 'both') {
          const passengerChannel = client.channels.get(`passenger:${user.id}`);
          passengerChannel.subscribe((message) => {
            console.log('Passenger message:', message.name, message.data);
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['rides'] });
          });
        }

      } catch (error) {
        console.error('Failed to initialize Ably:', error);
      }
    };

    initAbly();

    return () => {
      if (ablyRef.current) {
        ablyRef.current.close();
        ablyRef.current = null;
      }
    };
  }, [user]);

  return ablyRef.current;
}