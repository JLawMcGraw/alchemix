'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FavoritesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to recipes page with favorites tab
    router.replace('/recipes?tab=favorites');
  }, [router]);

  return null;
}
