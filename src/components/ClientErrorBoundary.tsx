'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ClientErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Client-side Error Boundary Wrapper
 *
 * Wraps children in an error boundary for use in server components.
 */
export function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default ClientErrorBoundary;
