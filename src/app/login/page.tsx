'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { validatePassword as validatePasswordPolicy, checkPasswordRequirements } from '@/lib/passwordPolicy';
import { AlcheMixLogo, ElementCard } from '@/components/ui';
import type { PeriodicElement } from '@/lib/periodicTable';
import styles from './login.module.css';

// Sample elements organized by category (4 rows x 4 columns)
const PREVIEW_ROWS = [
  {
    title: 'BASE SPIRITS',
    elements: [
      { symbol: 'Rm', name: 'Rum', group: 'cane', atomicNumber: 1 },
      { symbol: 'Gn', name: 'Gin', group: 'juniper', atomicNumber: 5 },
      { symbol: 'Wh', name: 'Whiskey', group: 'grain', atomicNumber: 6 },
      { symbol: 'Tq', name: 'Tequila', group: 'agave', atomicNumber: 10 },
    ] as PeriodicElement[],
  },
  {
    title: 'LIQUEURS',
    elements: [
      { symbol: 'Ol', name: 'Orange Liqueur', group: 'sugar', atomicNumber: 23 },
      { symbol: 'Ct', name: 'Chartreuse', group: 'sugar', atomicNumber: 33 },
      { symbol: 'Am', name: 'Amaretto', group: 'sugar', atomicNumber: 25 },
      { symbol: 'Ms', name: 'Maraschino', group: 'sugar', atomicNumber: 27 },
    ] as PeriodicElement[],
  },
  {
    title: 'MODIFIERS',
    elements: [
      { symbol: 'Cp', name: 'Campari', group: 'botanical', atomicNumber: 66 },
      { symbol: 'Sv', name: 'Sweet Vermouth', group: 'botanical', atomicNumber: 67 },
      { symbol: 'Dv', name: 'Dry Vermouth', group: 'botanical', atomicNumber: 68 },
      { symbol: 'Ab', name: 'Angostura', group: 'botanical', atomicNumber: 70 },
    ] as PeriodicElement[],
  },
  {
    title: 'CITRUS',
    elements: [
      { symbol: 'Li', name: 'Lime', group: 'acid', atomicNumber: 48 },
      { symbol: 'Le', name: 'Lemon', group: 'acid', atomicNumber: 49 },
      { symbol: 'Or', name: 'Orange', group: 'acid', atomicNumber: 50 },
      { symbol: 'Gf', name: 'Grapefruit', group: 'acid', atomicNumber: 51 },
    ] as PeriodicElement[],
  },
];

/**
 * AlcheMix Login Page
 * 
 * Hero layout with modal:
 * - Full page hero with periodic table preview
 * - Modal appears on "Log In" or "Get Started" click
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, _hasHydrated, validateToken } = useStore();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Password requirements
  const passwordChecks = checkPasswordRequirements(password);
  const showPasswordRequirements = isSignup && password.length > 0;

  // Get user from store for onboarding check
  const { user } = useStore();

  // Validate existing session on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!_hasHydrated) return;
      try {
        const isValid = await validateToken();
        if (isValid) {
          // validateToken updates user in store, redirect happens in next effect
        }
      } catch {
        // Stay on login page
      }
    };
    checkExistingAuth();
  }, [_hasHydrated, validateToken]);

  // Redirect after successful authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check if user has completed onboarding (seeded classics)
      router.push(user.has_seeded_classics ? '/dashboard' : '/onboarding');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    if (isSignup) {
      if (!confirmPassword) {
        setFormError('Please confirm your password');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return;
      }
      const validation = validatePasswordPolicy(password);
      if (!validation.isValid) {
        setFormError(validation.errors[0]);
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        await signup({ email, password });
        setSignupSuccess(true);
        setIsSignup(false);
        setPassword('');
      } else {
        await login({ email, password });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.landing}>
      {/* Grid background */}
      <div className={styles.gridBg} />

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <AlcheMixLogo size="sm" showText={true} showTagline={false} />
        </div>
        <div className={styles.navActions}>
          <button
            className={styles.btnPrimary}
            onClick={() => { setShowModal(true); setIsSignup(false); setFormError(''); }}
          >
            Log In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Left: Content */}
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>Molecular Mixology OS</div>
            <h1 className={styles.heroTitle}>
              The periodic table<br />for your bar
            </h1>
            <p className={styles.heroSubtitle}>
              Every ingredient classified by function. Every recipe visualized 
              as a molecular formula. Scientific precision for cocktail craft.
            </p>
            <div className={styles.heroCtas}>
              <button 
                className={styles.btnPrimary}
                onClick={() => { setShowModal(true); setIsSignup(true); setFormError(''); }}
              >
                Start Building
              </button>
            </div>
          </div>

          {/* Right: Periodic Table Preview using V1 ElementCard */}
          <div className={styles.heroVisual}>
            <div className={styles.tablePreview}>
              {PREVIEW_ROWS.map((row) => (
                <div key={row.title} className={styles.tableRow}>
                  <div className={styles.rowLabel}>{row.title}</div>
                  <div className={styles.rowElements}>
                    {row.elements.map((element) => (
                      <ElementCard
                        key={element.symbol}
                        element={element}
                        size="lg"
                        hasInventory={true}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowModal(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className={styles.modalHeader}>
              <AlcheMixLogo size="sm" showText={true} showTagline={false} />
            </div>

        <h2 className={styles.modalTitle}>
          {isSignup ? 'Create account' : 'Welcome back'}
        </h2>
        <p className={styles.modalSubtitle}>
          {isSignup ? 'Start building your molecular bar' : 'Log in to continue'}
        </p>

        {/* Success Message */}
        {signupSuccess && (
          <div className={styles.successMessage}>
            Account created! Check your email for a verification link.
          </div>
        )}

        {/* Error Message */}
        {formError && (
          <div className={styles.errorMessage}>{formError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input
              type="email"
              className={styles.formInput}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <div className={styles.formInputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.formInput}
                placeholder={isSignup ? 'Create password' : 'Enter password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Password Requirements */}
            {showPasswordRequirements && (
              <div className={styles.requirements}>
                <div className={`${styles.reqItem} ${passwordChecks.minLength ? styles.met : ''}`}>
                  <span className={styles.reqIcon}>{passwordChecks.minLength ? '✓' : ''}</span>
                  <span>At least 8 characters</span>
                </div>
                <div className={`${styles.reqItem} ${passwordChecks.hasUppercase ? styles.met : ''}`}>
                  <span className={styles.reqIcon}>{passwordChecks.hasUppercase ? '✓' : ''}</span>
                  <span>One uppercase letter</span>
                </div>
                <div className={`${styles.reqItem} ${passwordChecks.hasNumberOrSymbol ? styles.met : ''}`}>
                  <span className={styles.reqIcon}>{passwordChecks.hasNumberOrSymbol ? '✓' : ''}</span>
                  <span>One number or symbol</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password (signup only) */}
          {isSignup && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirm Password</label>
              <div className={styles.formInputWrapper}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={styles.formInput}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <button type="submit" className={`${styles.btnPrimary} ${styles.btnFull}`} disabled={loading}>
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Log In'}
          </button>
        </form>

            <div className={styles.modalFooter}>
              {isSignup ? (
                <>Have an account? <button onClick={() => { setIsSignup(false); setFormError(''); setConfirmPassword(''); }}>Log in</button></>
              ) : (
                <>Need an account? <button onClick={() => { setIsSignup(true); setFormError(''); }}>Sign up</button></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
