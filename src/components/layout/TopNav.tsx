'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { Settings, LogOut } from 'lucide-react';
import { AlcheMixLogo } from '@/components/ui';
import styles from './TopNav.module.css';

export const TopNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use shallow comparison to prevent rerenders from unrelated state changes
  const { user, isAuthenticated, logout, shoppingListItems } = useStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      logout: state.logout,
      shoppingListItems: state.shoppingListItems,
    }))
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  // Get user initials for avatar
  const getUserInitials = (): string => {
    if (!user?.email) return '?';
    const email = user.email;
    const username = email.split('@')[0];
    if (username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    return username.charAt(0).toUpperCase();
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    router.push('/login');
  };

  // Badge count for shopping list (only unchecked items)
  const shoppingListCount = Array.isArray(shoppingListItems)
    ? shoppingListItems.filter(item => !item.checked).length
    : 0;

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/bar', label: 'My Bar' },
    { href: '/ai', label: 'Ask the Bartender', indicator: true },
    { href: '/recipes', label: 'Recipes' },
    { href: '/shopping-list', label: 'Shopping List', badge: shoppingListCount > 0 ? shoppingListCount : undefined },
  ];

  // Don't show nav on login, onboarding, or if not authenticated
  if (pathname === '/login' || pathname === '/onboarding' || !isAuthenticated) {
    return null;
  }

  return (
    <nav className={styles.topNav}>
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/dashboard" className={styles.logo}>
          <AlcheMixLogo size="sm" showText={true} />
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
              {item.indicator && <span className={styles.aiIndicator} />}
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge !== undefined && (
                <span className={styles.badge}>{item.badge}</span>
              )}
            </Link>
          ))}
        </div>

        {/* User Avatar */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`${styles.avatar} ${userMenuOpen ? styles.avatarOpen : ''}`}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            {getUserInitials()}
          </button>

          {/* Dropdown Menu */}
          <div className={`${styles.dropdownMenu} ${userMenuOpen ? styles.dropdownOpen : ''}`}>
            {/* User Info */}
            <div className={styles.menuHeader}>
              <div className={styles.menuName}>{user?.email?.split('@')[0] || 'User'}</div>
              <div className={styles.menuEmail}>{user?.email}</div>
            </div>

            <div className={styles.menuDivider} />

            {/* Menu Items */}
            <div className={styles.menuSection}>
              <Link
                href="/account"
                className={styles.menuItem}
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings size={16} className={styles.menuIcon} />
                <span>Settings</span>
              </Link>
            </div>

            <div className={styles.menuDivider} />

            {/* Logout */}
            <div className={styles.menuSection}>
              <button onClick={handleLogout} className={`${styles.menuItem} ${styles.danger}`}>
                <LogOut size={16} className={styles.menuIcon} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
