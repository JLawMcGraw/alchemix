'use client';

import { Suspense } from 'react';
import { TopNav } from './TopNav';

export function TopNavWrapper() {
  return (
    <Suspense fallback={<div style={{ height: '72px' }} />}>
      <TopNav />
    </Suspense>
  );
}
