'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check, X, Grid3X3, Hexagon, Wine, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { validatePassword as validatePasswordPolicy, checkPasswordRequirements } from '@/lib/passwordPolicy';
import { AlcheMixLogo } from '@/components/ui';
import { RecipeMolecule } from '@/components/RecipeMolecule';
import { classifyIngredient, parseIngredient, generateFormula, toOunces, TYPE_COLORS, type IngredientType } from '@alchemix/recipe-molecule';
import { GROUPS, PERIODS, type ElementType, type MixologyGroup, type MixologyPeriod } from '@/lib/periodicTableV2';
import type { Recipe } from '@/types';
import styles from './login.module.css';

// Map ingredient types to CSS variable names for bond colors
const TYPE_TO_CSS_VAR: Record<IngredientType, string> = {
  spirit: '--bond-agave',
  acid: '--bond-acid',
  sweet: '--bond-sweet',
  bitter: '--bond-botanical',
  salt: '--bond-salt',
  dilution: '--bond-carbonation',
  garnish: '--bond-garnish',
  dairy: '--bond-dairy',
  egg: '--bond-egg',
  junction: '--fg-tertiary',
};

// Get 2-letter symbol for ingredient type
const TYPE_SYMBOLS: Record<IngredientType, string> = {
  spirit: 'Sp',
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  salt: 'Sa',
  dilution: 'Mx',
  garnish: 'Gn',
  dairy: 'Dy',
  egg: 'Eg',
  junction: '',
};

// Format balance value
function formatBalanceValue(value: number): string {
  if (value === 0) return '0';
  if (value < 0.05) return 'trace';
  if (value < 1) return value.toFixed(2);
  return value.toFixed(1);
}

/**
 * AlcheMix Landing Page
 *
 * Full marketing landing page with:
 * - Hero section with periodic table preview
 * - Features grid
 * - Demo section with recipe molecule visualization
 * - Login/Signup modal
 */
export default function LandingPage() {
  const router = useRouter();
  const { login, signup, isAuthenticated, _hasHydrated, validateToken } = useStore();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSignupMode, setIsSignupMode] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Refs for scroll navigation
  const featuresRef = useRef<HTMLElement>(null);

  // Real-time password requirement checks
  const passwordChecks = checkPasswordRequirements(password);
  const showPasswordRequirements = isSignupMode && (passwordFocused || password.length > 0);

  // Sample elements for the periodic table preview - 3x4 grid showing Groups 1-4, Periods 1-3
  // Positioned correctly: [period][group] = element
  const sampleGrid: (ElementType | null)[][] = [
    // Period 1 (Agave): Base, Bridge (empty), Modifier, Sweetener
    [
      { symbol: 'Tq', name: 'Tequila', group: 1 as MixologyGroup, period: 1 as MixologyPeriod, abv: '40%', keywords: [] },
      null, // Bridge - rare for Agave
      { symbol: 'Av', name: 'Agavero', group: 3 as MixologyGroup, period: 1 as MixologyPeriod, abv: '32%', keywords: [] },
      { symbol: 'Ag', name: 'Agave Nectar', group: 4 as MixologyGroup, period: 1 as MixologyPeriod, brix: '75', keywords: [] },
    ],
    // Period 2 (Cane): Base, Bridge (empty), Modifier, Sweetener
    [
      { symbol: 'Rm', name: 'Rum', group: 1 as MixologyGroup, period: 2 as MixologyPeriod, abv: '40-50%', keywords: [] },
      null, // Bridge - rare for Cane
      { symbol: 'Fa', name: 'Falernum', group: 3 as MixologyGroup, period: 2 as MixologyPeriod, abv: '11-18%', keywords: [] },
      { symbol: 'De', name: 'Demerara', group: 4 as MixologyGroup, period: 2 as MixologyPeriod, brix: '65', keywords: [] },
    ],
    // Period 3 (Grain): Base, Bridge, Modifier, Sweetener
    [
      { symbol: 'Wh', name: 'Whiskey', group: 1 as MixologyGroup, period: 3 as MixologyPeriod, abv: '40-50%', keywords: [] },
      { symbol: 'Ir', name: 'Irish Cream', group: 2 as MixologyGroup, period: 3 as MixologyPeriod, abv: '17%', keywords: [] },
      { symbol: 'Ky', name: 'Kahlúa', group: 3 as MixologyGroup, period: 3 as MixologyPeriod, abv: '20%', keywords: [] },
      { symbol: 'Si', name: 'Simple Syrup', group: 4 as MixologyGroup, period: 3 as MixologyPeriod, brix: '50', keywords: [] },
    ],
  ];

  // Group labels for preview
  const previewGroups = [
    { num: 1, name: 'Base' },
    { num: 2, name: 'Bridge' },
    { num: 3, name: 'Modifier' },
    { num: 4, name: 'Sweetener' },
  ];

  // Period labels for preview
  const previewPeriods = [
    { num: 1, name: 'Agave' },
    { num: 2, name: 'Cane' },
    { num: 3, name: 'Grain' },
  ];

  // Helper to get element spec string
  const getElementSpec = (el: ElementType): string | null => {
    if (el.abv) return el.abv;
    if (el.brix) return `${el.brix}° Bx`;
    if (el.ph) return `pH ${el.ph}`;
    if (el.usage) return el.usage;
    return null;
  };

  // Sample recipe for the demo (Planter's Punch - Smuggler's Cove style)
  const sampleRecipe: Recipe = {
    id: 0,
    name: "Planter's Punch",
    ingredients: [
      '3/4 oz Fresh lime juice',
      '3/4 oz Simple syrup',
      '1 1/2 oz Blended aged rum',
      '1 1/2 oz Black blended rum',
      '1 dash Angostura bitters',
    ],
    instructions: 'Add all ingredients to a shaker with ice. Shake and strain into a Collins glass filled with crushed ice. Garnish with a mint sprig.',
    glass: 'Collins',
    category: 'Tiki',
    formula: 'Rm₃ · Lm₀.₇₅ · Si₀.₇₅ · An',
    spirit_type: 'rum',
  };

  // Spirit colors for badges
  const spiritColors: Record<string, string> = {
    gin: '#0EA5E9',
    whiskey: '#D97706',
    rum: '#65A30D',
    tequila: '#0D9488',
    vodka: '#94A3B8',
    brandy: '#8B5CF6',
  };

  // Features data
  const features = [
    {
      icon: <Grid3X3 size={24} strokeWidth={1.5} />,
      title: 'Periodic Table',
      desc: 'Every ingredient classified by function and origin. Substitutes at a glance.',
    },
    {
      icon: <Hexagon size={24} strokeWidth={1.5} />,
      title: 'Molecular Recipes',
      desc: 'Visualize cocktails as chemical formulas with node-link diagrams.',
    },
    {
      icon: <Wine size={24} strokeWidth={1.5} />,
      title: 'Smart Inventory',
      desc: 'Track stock levels. Know what you can make with what you have.',
    },
    {
      icon: <Sparkles size={24} strokeWidth={1.5} />,
      title: 'AI Bartender',
      desc: 'Get personalized recommendations based on your bar inventory.',
    },
  ];

  // Validate existing session on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!_hasHydrated) return;

      try {
        const isValid = await validateToken();
        if (isValid) {
          router.push('/dashboard');
          return;
        }
      } catch {
        // Token validation failed, stay on landing page
      }
    };

    checkExistingAuth();
  }, [_hasHydrated, validateToken, router]);

  // Redirect after successful login
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

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
        setSignupSuccess(true);
        setIsSignupMode(false);
        setPassword('');
        setConfirmPassword('');
        return;
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

  const openModal = (signup: boolean) => {
    setIsSignupMode(signup);
    setShowModal(true);
    setFormError('');
    setSignupSuccess(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFormError('');
  };

  const toggleMode = () => {
    setIsSignupMode(!isSignupMode);
    setFormError('');
    setConfirmPassword('');
    setSignupSuccess(false);
  };

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <AlcheMixLogo size="sm" showText={true} />
        </div>

        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={scrollToFeatures}>Features</button>
          <button className={styles.navLink} onClick={scrollToFeatures}>Periodic Table</button>
        </div>

        <div className={styles.navActions}>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => openModal(false)}
          >
            Log In
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => openModal(true)}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>Molecular Mixology OS</div>
          <h1 className={styles.heroTitle}>
            The periodic table<br />
            for your bar
          </h1>
          <p className={styles.heroSubtitle}>
            Classify ingredients by function. Visualize recipes as molecular
            formulas. Track inventory with precision. Discover what you can
            make with what you have.
          </p>
          <div className={styles.heroCtas}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => openModal(true)}
            >
              Start Building
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={scrollToFeatures}
            >
              Learn More
            </button>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.periodicPreview}>
            {/* Group Headers Row */}
            <div className={styles.gridCorner} />
            {previewGroups.map((group) => (
              <div
                key={group.num}
                className={styles.groupHeader}
                style={{ '--group-color': GROUPS[group.num as MixologyGroup].color } as React.CSSProperties}
              >
                <span className={styles.groupNum}>{group.num}.</span>
                <span className={styles.groupName}>{group.name}</span>
              </div>
            ))}

            {/* Period Rows */}
            {sampleGrid.map((row, periodIndex) => {
              const periodNum = (periodIndex + 1) as MixologyPeriod;
              const periodInfo = PERIODS[periodNum];

              return (
                <React.Fragment key={periodIndex}>
                  {/* Period Label */}
                  <div
                    className={styles.periodLabel}
                    style={{ '--period-color': periodInfo.color } as React.CSSProperties}
                  >
                    <span className={styles.periodNum}>{periodNum}</span>
                    <span className={styles.periodName}>{periodInfo.name}</span>
                  </div>

                  {/* Element Cells */}
                  {row.map((element, groupIndex) => {
                    const groupNum = (groupIndex + 1) as MixologyGroup;
                    const groupInfo = GROUPS[groupNum];

                    if (!element) {
                      // Empty/rare cell
                      return (
                        <div
                          key={groupIndex}
                          className={`${styles.elementCell} ${styles.emptyCell}`}
                        >
                          <div className={styles.elementSymbol}>--</div>
                          <div className={styles.elementName}>Rare</div>
                        </div>
                      );
                    }

                    const spec = getElementSpec(element);

                    return (
                      <div
                        key={groupIndex}
                        className={styles.elementCell}
                        style={{
                          '--group-color': groupInfo.color,
                          '--period-color': periodInfo.color,
                        } as React.CSSProperties}
                      >
                        {/* Period indicator dot */}
                        <div
                          className={styles.periodDot}
                          style={{ backgroundColor: periodInfo.color }}
                        />

                        {/* Symbol */}
                        <div className={styles.elementSymbol}>
                          {element.symbol}
                        </div>

                        {/* Name */}
                        <div className={styles.elementName}>
                          {element.name}
                        </div>

                        {/* Spec (ABV, Brix, pH) */}
                        {spec && (
                          <div className={styles.elementSpec}>
                            {spec}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features} ref={featuresRef}>
        <div className={styles.featuresHeader}>
          <div className={styles.featuresLabel}>Features</div>
          <h2 className={styles.featuresTitle}>
            Scientific precision for cocktail craft
          </h2>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo Section */}
      <section className={styles.demo}>
        <div className={styles.demoContent}>
          <div className={styles.demoText}>
            <h2>Recipes as molecular formulas</h2>
            <p>
              Every cocktail is a chemical equation. See the balance of
              spirit, acid, and sweetness at a glance. Understand what
              makes a drink work—and how to riff on it.
            </p>
            <ul className={styles.demoList}>
              <li>
                <span className={styles.demoCheck}>✓</span>
                Chemical notation for every recipe
              </li>
              <li>
                <span className={styles.demoCheck}>✓</span>
                Node-link molecular diagrams
              </li>
              <li>
                <span className={styles.demoCheck}>✓</span>
                Smart substitution suggestions
              </li>
              <li>
                <span className={styles.demoCheck}>✓</span>
                Filter by what you can make
              </li>
            </ul>
          </div>

          {/* Recipe Demo Card - matches RecipeDetailModal */}
          <div className={styles.recipeDemo}>
            {/* Header */}
            <div className={styles.recipeHeader}>
              <div className={styles.recipeTitleSection}>
                <h3 className={styles.recipeTitle}>{sampleRecipe.name}</h3>
                <span className={styles.recipeFormula}>{generateFormula(sampleRecipe.ingredients as string[])}</span>
              </div>
              {/* Spirit Badge */}
              {sampleRecipe.spirit_type && (
                <span
                  className={styles.spiritBadge}
                  style={{
                    backgroundColor: `${spiritColors[sampleRecipe.spirit_type] || '#94A3B8'}15`,
                    color: spiritColors[sampleRecipe.spirit_type] || '#94A3B8',
                    borderColor: spiritColors[sampleRecipe.spirit_type] || '#94A3B8',
                  }}
                >
                  {sampleRecipe.spirit_type}
                </span>
              )}
            </div>

            {/* Content */}
            <div className={styles.recipeContent}>
              {/* Molecule Visualization */}
              <div className={styles.moleculeSection}>
                <RecipeMolecule recipe={sampleRecipe} size="full" showLegend={false} />
              </div>

              {/* Ingredients Section */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Ingredients</h4>
                <ul className={styles.ingredientsList}>
                  {(sampleRecipe.ingredients as string[]).map((ingredient, index) => {
                    const parsed = parseIngredient(ingredient);
                    const classified = classifyIngredient(parsed);
                    const cssVar = TYPE_TO_CSS_VAR[classified.type];
                    const symbol = TYPE_SYMBOLS[classified.type];

                    return (
                      <li key={index} className={styles.ingredientItem}>
                        <span
                          className={styles.ingredientPip}
                          style={{ backgroundColor: `var(${cssVar})` }}
                          title={TYPE_COLORS[classified.type].legend}
                        >
                          {symbol}
                        </span>
                        <span className={styles.ingredientText}>{ingredient}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Stoichiometric Balance Section */}
              {(() => {
                const balanceCounts = { spirit: 0, bitter: 0, sweet: 0, acid: 0 };
                (sampleRecipe.ingredients as string[]).forEach((ingredient) => {
                  const parsed = parseIngredient(ingredient);
                  const classified = classifyIngredient(parsed);
                  const volume = toOunces(parsed.amount, parsed.unit);
                  if (classified.type === 'spirit') balanceCounts.spirit += volume;
                  else if (classified.type === 'bitter') balanceCounts.bitter += volume;
                  else if (classified.type === 'sweet') balanceCounts.sweet += volume;
                  else if (classified.type === 'acid') balanceCounts.acid += volume;
                });
                const maxValue = Math.max(...Object.values(balanceCounts), 0.01);

                return (
                  <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Stoichiometric Balance</h4>
                    <div className={styles.balanceSection}>
                      <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Spirit</span>
                        <div className={styles.balanceTrack}>
                          <div
                            className={styles.balanceFill}
                            style={{
                              width: `${(balanceCounts.spirit / maxValue) * 100}%`,
                              backgroundColor: 'var(--bond-agave)'
                            }}
                          />
                        </div>
                        <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.spirit)}</span>
                      </div>
                      <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Bitter</span>
                        <div className={styles.balanceTrack}>
                          <div
                            className={styles.balanceFill}
                            style={{
                              width: `${(balanceCounts.bitter / maxValue) * 100}%`,
                              backgroundColor: 'var(--bond-botanical)'
                            }}
                          />
                        </div>
                        <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.bitter)}</span>
                      </div>
                      <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Sweet</span>
                        <div className={styles.balanceTrack}>
                          <div
                            className={styles.balanceFill}
                            style={{
                              width: `${(balanceCounts.sweet / maxValue) * 100}%`,
                              backgroundColor: 'var(--bond-sweet)'
                            }}
                          />
                        </div>
                        <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.sweet)}</span>
                      </div>
                      <div className={styles.balanceRow}>
                        <span className={styles.balanceLabel}>Acid</span>
                        <div className={styles.balanceTrack}>
                          <div
                            className={styles.balanceFill}
                            style={{
                              width: `${(balanceCounts.acid / maxValue) * 100}%`,
                              backgroundColor: 'var(--bond-acid)'
                            }}
                          />
                        </div>
                        <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.acid)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to build your molecular bar?</h2>
        <p className={styles.ctaSubtitle}>Free to start. No credit card required.</p>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => openModal(true)}
        >
          Get Started Free
        </button>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <AlcheMixLogo size="sm" showText={false} />
          <span className={styles.footerCopy}>© 2025 AlcheMix</span>
        </div>
        <div className={styles.footerLinks}>
          <button className={styles.footerLink}>Privacy</button>
          <button className={styles.footerLink}>Terms</button>
          <button className={styles.footerLink}>Contact</button>
        </div>
      </footer>

      {/* Login/Signup Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal}>
              <X size={20} />
            </button>

            <div className={styles.modalHeader}>
              <AlcheMixLogo size="sm" showText={false} />
              <span className={styles.modalBrand}>AlcheMix</span>
            </div>

            <h2 className={styles.modalTitle}>
              {isSignupMode ? 'Create account' : 'Welcome back'}
            </h2>
            <p className={styles.modalSubtitle}>
              {isSignupMode ? 'Start building your molecular bar' : 'Log in to your account'}
            </p>

            {signupSuccess && (
              <div className={styles.successMessage}>
                Account created! Check your email for a verification link.
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
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
                <div className={styles.passwordInputWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.formInput}
                    placeholder={isSignupMode ? 'Create password' : 'Enter password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password requirements for signup */}
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

                {/* Forgot password link */}
                {!isSignupMode && (
                  <Link href="/forgot-password" className={styles.forgotPasswordLink}>
                    Forgot your password?
                  </Link>
                )}
              </div>

              {/* Confirm password for signup */}
              {isSignupMode && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Confirm Password</label>
                  <div className={styles.passwordInputWrapper}>
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
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className={styles.errorMessage}>{formError}</div>
              )}

              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
                disabled={loading}
              >
                {loading ? 'Loading...' : isSignupMode ? 'Create Account' : 'Log In'}
              </button>
            </form>

            <div className={styles.modalFooter}>
              {isSignupMode ? (
                <>Have an account? <button onClick={toggleMode}>Log in</button></>
              ) : (
                <>Need an account? <button onClick={toggleMode}>Sign up</button></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
