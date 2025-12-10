'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { Home, Wine, Sparkles, BookOpen, ShoppingCart, Star, LogOut, Menu, X, User, Settings } from 'lucide-react';
import { AlcheMixLogo, VerificationBanner } from '@/components/ui';
import styles from './TopNav.module.css';

export const TopNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use shallow comparison to prevent rerenders from unrelated state changes
  const { user, isAuthenticated, logout } = useStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      logout: state.logout,
    }))
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push('/login');
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // Don't show nav on login page
  if (pathname === '/login') {
    return null;
  }

  // If not authenticated, don't show nav
  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', Icon: Home },
    { href: '/bar', label: 'My Bar', Icon: Wine },
    { href: '/ai', label: 'AI Bartender', Icon: Sparkles },
    { href: '/recipes', label: 'Recipes', Icon: BookOpen },
    { href: '/shopping-list', label: 'Shopping List', Icon: ShoppingCart },
    { href: '/favorites', label: 'Favorites', Icon: Star },
  ];

  return (
    <>
      <nav className={styles.topNav}>
        <div className={styles.container}>
          {/* Logo */}
          <Link href="/dashboard" className={styles.logo}>
            <AlcheMixLogo size="sm" showText={true} />
          </Link>

          {/* Navigation Links */}
          <div className={styles.navLinks}>
            {navItems.map((item) => {
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${
                    pathname === item.href ? styles.active : ''
                  }`}
                >
                  <Icon className={styles.navIcon} size={18} />
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Hamburger Menu */}
          <div className={styles.menuContainer} ref={menuRef}>
            <button
              onClick={toggleMenu}
              className={styles.hamburgerBtn}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Dropdown Menu */}
            <div className={`${styles.dropdownMenu} ${menuOpen ? styles.dropdownOpen : ''}`}>
              {/* User Email */}
              <div className={styles.menuHeader}>
                <span className={styles.menuEmail}>{user?.email}</span>
              </div>

              <div className={styles.menuDivider} />

              {/* Menu Items */}
              <Link
                href="/account"
                className={styles.menuItem}
                onClick={() => setMenuOpen(false)}
              >
                <User size={18} />
                <span>Account</span>
              </Link>

              <Link
                href="/settings"
                className={styles.menuItem}
                onClick={() => setMenuOpen(false)}
              >
                <Settings size={18} />
                <span>Settings</span>
              </Link>

              <div className={styles.menuDivider} />

              {/* Logout */}
              <button onClick={handleLogout} className={styles.menuItem}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <VerificationBanner />
    </>
  );
};
