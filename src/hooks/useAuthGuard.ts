// Auth Guard Hook
// Protects pages by validating token and redirecting if not authenticated
//
// With httpOnly cookie-based auth, we can't check if a token exists in JS.
// Instead, we always call validateToken() which tries to fetch /auth/me.
// If the cookie is valid, it succeeds; if not, it fails and we redirect.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export function useAuthGuard() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, validateToken } = useStore();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for Zustand hydration to complete
      if (!_hasHydrated) {
        return;
      }

      // With httpOnly cookies, we can't check if token exists in JS
      // Always validate by calling the backend - cookie is sent automatically
      await validateToken();

      setIsValidating(false);
    };

    checkAuth();
  }, [_hasHydrated, validateToken]);

  // Redirect to login if not authenticated (after validation completes)
  useEffect(() => {
    if (!isValidating && !isAuthenticated) {
      router.push('/login');
    }
  }, [isValidating, isAuthenticated, router]);

  return { isValidating, isAuthenticated };
}
