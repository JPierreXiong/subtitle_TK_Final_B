import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    const handler = toNextJsHandler(auth.handler);
    const response = await handler.POST(request);
    
    const url = new URL(request.url);
    
    // Handle sign-out endpoint: 400 error may indicate "no session", which is acceptable
    if (url.pathname.includes('sign-out') && response.status === 400) {
      // Return 200 to indicate successful sign-out (whether session existed or not)
      return new Response(
        JSON.stringify({ success: true, message: 'Signed out successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle sign-up/sign-in 422 errors: Log detailed error for debugging
    if ((url.pathname.includes('sign-up') || url.pathname.includes('sign-in')) && response.status === 422) {
      try {
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        const errorData = await responseClone.json();
        
        console.error('[Auth] ❌ 422 UNPROCESSABLE_ENTITY on', url.pathname);
        console.error('[Auth] Error details:', {
          path: url.pathname,
          status: response.status,
          error: errorData,
          timestamp: new Date().toISOString(),
        });
        console.error('[Auth] Possible causes:');
        console.error('  1. Email format invalid');
        console.error('  2. Password too short (min 8 chars usually)');
        console.error('  3. Name field missing or invalid');
        console.error('  4. Email already exists in database');
        console.error('  5. Database constraint violation');
      } catch (e) {
        // If response body is not JSON, just log the status
        console.error('[Auth] ❌ 422 error on', url.pathname, '- Unable to parse error response');
      }
    }
    
    return response;
  } catch (error) {
    console.error('[Auth] ❌ POST error:', error);
    const url = new URL(request.url);
    console.error('[Auth] Request path:', url.pathname);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    const handler = toNextJsHandler(auth.handler);
    return handler.GET(request);
  } catch (error) {
    console.error('Auth GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
