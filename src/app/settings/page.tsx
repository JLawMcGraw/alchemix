'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Settings page now redirects to /account which contains all settings
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account');
  }, [router]);

  return null;
}
