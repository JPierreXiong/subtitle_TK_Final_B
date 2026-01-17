import { headers } from 'next/headers';
import { count, desc, eq, inArray } from 'drizzle-orm';

import { getAuth } from '@/core/auth';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';
import { envConfigs } from '@/config';

import { Permission, Role } from '../services/rbac';
import { getRemainingCredits } from './credit';

export interface UserCredits {
  remainingCredits: number;
  expiresAt: Date | null;
}

export type User = typeof user.$inferSelect & {
  isAdmin?: boolean;
  credits?: UserCredits;
  roles?: Role[];
  permissions?: Permission[];
};
export type NewUser = typeof user.$inferInsert;
export type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt' | 'email'>>;

export async function updateUser(userId: string, updatedUser: UpdateUser) {
  const [result] = await db()
    .update(user)
    .set(updatedUser)
    .where(eq(user.id, userId))
    .returning();

  return result;
}

export async function findUserById(userId: string) {
  const [result] = await db().select().from(user).where(eq(user.id, userId));

  return result;
}

export async function getUsers({
  page = 1,
  limit = 30,
  email,
}: {
  email?: string;
  page?: number;
  limit?: number;
} = {}): Promise<User[]> {
  const result = await db()
    .select()
    .from(user)
    .where(email ? eq(user.email, email) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

export async function getUsersCount({ email }: { email?: string }) {
  const [result] = await db()
    .select({ count: count() })
    .from(user)
    .where(email ? eq(user.email, email) : undefined);
  return result?.count || 0;
}

export async function getUserByUserIds(userIds: string[]) {
  const result = await db()
    .select()
    .from(user)
    .where(inArray(user.id, userIds));

  return result;
}

export async function getUserInfo() {
  const signUser = await getSignUser();

  return signUser;
}

export async function getUserCredits(userId: string) {
  const remainingCredits = await getRemainingCredits(userId);

  return { remainingCredits };
}

export async function getSignUser() {
  try {
    const auth = await getAuth();
    const headersList = await headers();
    
    // 🔍 Debug: Check Cookie header (only in development)
    if (process.env.NODE_ENV === 'development') {
      const cookieHeader = headersList.get('cookie');
      const hasSessionToken = cookieHeader?.includes('better-auth.session_token');
      console.debug('[getSignUser] Cookie header present:', !!cookieHeader);
      console.debug('[getSignUser] Session token in cookie:', hasSessionToken);
      
      // Check if Cookie Secure might be blocking cookie transmission
      if (!cookieHeader) {
        const cookieSecure = process.env.BETTER_AUTH_COOKIE_SECURE || process.env.NEXT_PUBLIC_BETTER_AUTH_COOKIE_SECURE;
        const isHttps = envConfigs.auth_url?.startsWith('https://') || envConfigs.app_url?.startsWith('https://');
        
        if (cookieSecure === 'true' && !isHttps) {
          console.warn('[getSignUser] ⚠️  Cookie Secure=true but using HTTP! Cookies may not be sent.');
          console.warn('[getSignUser] 💡 Fix: Set BETTER_AUTH_COOKIE_SECURE=false for local development');
        }
      }
      
      if (cookieHeader && cookieHeader.length > 0) {
        // Log first 100 chars for debugging (without exposing full token)
        console.debug('[getSignUser] Cookie preview:', cookieHeader.substring(0, 100) + '...');
      }
    }
    
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug('[getSignUser] Session retrieved:', !!session);
    }
    
    return session?.user;
  } catch (error: any) {
    // Log error details for debugging
    console.error('[getSignUser] ❌ Error getting session:', {
      message: error.message,
      code: error.code,
      name: error.name,
      // Log stack trace in development only
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack?.substring(0, 300) }),
    });
    
    // Additional diagnostic information
    if (process.env.NODE_ENV === 'development') {
      console.error('[getSignUser] Diagnostic info:', {
        hasAuthSecret: !!process.env.AUTH_SECRET,
        authSecretLength: process.env.AUTH_SECRET?.length || 0,
        authUrl: process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
        recommendation: 'Run: pnpm tsx scripts/diagnose-auth-comprehensive.ts',
      });
    }
    
    // Check if this is a domain mismatch issue
    if (error.message?.includes('host') || error.message?.includes('origin') || error.message?.includes('domain')) {
      console.error('[getSignUser] Possible domain mismatch. Check AUTH_URL matches the request host.');
    }
    
    // Check if this is a timeout-related error (database query taking too long)
    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      console.error('[getSignUser] ⚠️  Database query timeout. Check database connection and network.');
      // Return null to allow retry instead of throwing (better UX)
      return null;
    }
    
    // If it's a database connection error, throw with more context
    if (error.message?.includes('connection') || error.message?.includes('database')) {
      console.error('[getSignUser] ⚠️  Database connection error. Check DATABASE_URL configuration.');
      // Return null to allow retry instead of throwing (better UX)
      return null;
    }
    
    // If it's a session error, return null (user is not signed in)
    if (error.code === 'FAILED_TO_GET_SESSION' || error.message?.includes('session')) {
      // This is acceptable - user may not be signed in
      return null;
    }
    
    // Re-throw other errors (unexpected errors)
    throw error;
  }
}

export async function appendUserToResult(result: any) {
  if (!result || !result.length) {
    return result;
  }

  const userIds = result.map((item: any) => item.userId);
  const users = await getUserByUserIds(userIds);
  result = result.map((item: any) => {
    const user = users.find((user: any) => user.id === item.userId);
    return { ...item, user };
  });

  return result;
}
