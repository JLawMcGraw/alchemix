'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const validateToken = useStore((state) => state.validateToken);

  useEffect(() => {
    // Validate token on mount before redirecting
    const checkAuth = async () => {
      // Only validate if we have a token in localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      if (token) {
        await validateToken();
      }

      setIsValidating(false);
    };

    checkAuth();
  }, [validateToken]);

  useEffect(() => {
    // Only redirect after validation is complete
    if (!isValidating) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isValidating, isAuthenticated, router]);

  // Show loading state while validating and redirecting
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'var(--font-body)',
      color: 'var(--color-text-muted)',
    }}>
      Loading...
    </div>
  );
}
