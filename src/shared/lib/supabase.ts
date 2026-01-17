'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client for client-side usage
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

/**
 * Singleton instance of Supabase client
 * Reuses the same client instance across the application
 */
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClientSingleton(): any {
  if (!supabaseClient) {
    supabaseClient = getSupabaseClient() as any;
  }
  return supabaseClient;
}
