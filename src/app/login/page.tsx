'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useStore } from '@/lib/store';
import { validatePassword as validatePasswordPolicy, checkPasswordRequirements } from '@/lib/passwordPolicy';
import { AlcheMixLogo, Button, Card, Input } from '@/components/ui';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, _hasHydrated, validateToken } = useStore();

  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Real-time password requirement checks
  const passwordChecks = checkPasswordRequirements(password);
  const showPasswordRequirements = isSignupMode && (passwordFocused || password.length > 0);

  // Validate existing token on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      // Wait for hydration
      if (!_hasHydrated) {
        return;
      }

      // Check if there's a token to validate
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        const isValid = await validateToken();
        if (isValid) {
          router.push('/dashboard');
          return;
        }
      }

      // Mark auth check as complete
      setIsCheckingAuth(false);
    };

    checkExistingAuth();
  }, [_hasHydrated, validateToken, router]);

  // Redirect immediately after successful login/signup
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

    if (isSignupMode) {
      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.isValid) {
        setFormError(passwordValidation.errors[0]);
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignupMode) {
        await signup({ email, password });
        // Show success message - user needs to verify email
        setSignupSuccess(true);
        setIsSignupMode(false);
        setPassword('');
        setConfirmPassword('');
        return;
      } else {
        await login({ email, password });
      }
      // Redirect happens via useEffect when isAuthenticated changes
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignupMode(!isSignupMode);
    setFormError('');
    setConfirmPassword('');
    setSignupSuccess(false);
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <AlcheMixLogo size="lg" showText={true} showTagline={true} />
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

          {signupSuccess && (
            <div className={styles.successMessage}>
              Account created! Check your email for a verification link to unlock all features.
            </div>
          )}

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

            <div>
              <div className={styles.passwordInputWrapper}>
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  fullWidth
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Real-time password requirements - only show when typing */}
              {showPasswordRequirements && (
                <div className={styles.passwordRequirements}>
                  <div className={`${styles.requirement} ${passwordChecks.minLength ? styles.requirementMet : ''}`}>
                    {passwordChecks.minLength && <Check size={14} className={styles.checkIcon} />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`${styles.requirement} ${passwordChecks.hasUppercase ? styles.requirementMet : ''}`}>
                    {passwordChecks.hasUppercase && <Check size={14} className={styles.checkIcon} />}
                    <span>Contains uppercase letter</span>
                  </div>
                  <div className={`${styles.requirement} ${passwordChecks.hasNumberOrSymbol ? styles.requirementMet : ''}`}>
                    {passwordChecks.hasNumberOrSymbol && <Check size={14} className={styles.checkIcon} />}
                    <span>Contains number or symbol</span>
                  </div>
                </div>
              )}

              {/* Forgot Password Link - only show in login mode */}
              {!isSignupMode && (
                <Link href="/forgot-password" className={styles.forgotPasswordLink}>
                  Forgot your password?
                </Link>
              )}
            </div>

            {isSignupMode && (
              <div className={styles.passwordInputWrapper}>
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  fullWidth
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            )}

            {formError && (
              <div className={styles.errorMessage}>
                {formError}
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
