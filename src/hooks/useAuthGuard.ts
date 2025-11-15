// Auth Guard Hook
// Protects pages by validating token and redirecting if not authenticated

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

      // Check if token exists in localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      if (token) {
        // Validate the token with the backend
        await validateToken();
      }

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
