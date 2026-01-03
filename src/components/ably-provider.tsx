"use client";

import { useAbly } from '@/hooks/use-ably';

export function AblyProvider() {
  useAbly(); // Initialize Ably connection
  return null;
}