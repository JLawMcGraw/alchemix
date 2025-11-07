'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, error } = useStore();

  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    if (isSignupMode && password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isSignupMode) {
        await signup({ email, password });
      } else {
        await login({ email, password });
      }
      // Redirect happens via useEffect when isAuthenticated changes
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignupMode(!isSignupMode);
    setFormError('');
    setConfirmPassword('');
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>🧪</div>
          <h1 className={styles.logoTitle}>AlcheMix</h1>
          <p className={styles.logoTagline}>Your cocktail lab assistant</p>
        </div>

        {/* Login/Signup Card */}
        <Card padding="lg" className={styles.loginCard}>
          <h2 className={styles.cardTitle}>
            {isSignupMode ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className={styles.cardSubtitle}>
            {isSignupMode
              ? 'Sign up to start mixing'
              : 'Sign in to your lab'}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              fullWidth
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              fullWidth
              disabled={loading}
            />

            {isSignupMode && (
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                fullWidth
                disabled={loading}
              />
            )}

            {(formError || error) && (
              <div className={styles.errorMessage}>
                {formError || error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading
                ? 'Loading...'
                : isSignupMode
                ? 'Create Account'
                : 'Sign In'}
            </Button>
          </form>

          <div className={styles.switchMode}>
            <button
              type="button"
              onClick={toggleMode}
              className={styles.switchModeBtn}
              disabled={loading}
            >
              {isSignupMode
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
