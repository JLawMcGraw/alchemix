'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import styles from './TopNav.module.css';

export const TopNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
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
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/bar', label: 'My Bar', icon: '🍾' },
    { href: '/ai', label: 'AI Bartender', icon: '🧪' },
    { href: '/recipes', label: 'Recipes', icon: '📖' },
    { href: '/favorites', label: 'Favorites', icon: '⭐' },
  ];

  return (
    <nav className={styles.topNav}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/dashboard" className={styles.logo}>
          <span className={styles.logoIcon}>🧪</span>
          <span className={styles.logoText}>AlcheMix</span>
        </Link>

        {/* Navigation Links */}
        <div className={styles.navLinks}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${
                pathname === item.href ? styles.active : ''
              }`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* User Menu */}
        <div className={styles.userMenu}>
          <span className={styles.userEmail}>{user?.email}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};
