'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Bottle } from '@/types';
import styles from './bar.module.css';

export default function BarPage() {
  const router = useRouter();
  const { isAuthenticated, bottles, fetchBottles, deleteBottle } = useStore();
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchBottles().catch(console.error);
  }, [isAuthenticated, router, fetchBottles]);

  if (!isAuthenticated) {
    return null;
  }

  // Get unique liquor types for filter
  const liquorTypes = ['all', ...new Set(bottles.map((b) => b['Liquor Type']).filter(Boolean))];

  // Filter bottles
  const filteredBottles =
    filterType === 'all'
      ? bottles
      : bottles.filter((b) => b['Liquor Type'] === filterType);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this bottle?')) {
      try {
        await deleteBottle(id);
      } catch (error) {
        console.error('Failed to delete bottle:', error);
      }
    }
  };

  return (
    <div className={styles.barPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🍾 My Bar</h1>
            <p className={styles.subtitle}>
              {filteredBottles.length} {filteredBottles.length === 1 ? 'bottle' : 'bottles'}
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="outline" size="md">
              📤 Import CSV
            </Button>
            <Button variant="primary" size="md">
              ➕ Add Bottle
            </Button>
          </div>
        </div>

        {/* Filter */}
        <div className={styles.filterSection}>
          <label htmlFor="liquorType" className={styles.filterLabel}>
            Filter by Type:
          </label>
          <select
            id="liquorType"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            {liquorTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>

        {/* Inventory Table */}
        {filteredBottles.length === 0 ? (
          <Card padding="lg">
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🍸</div>
              <h3 className={styles.emptyTitle}>Your bar is empty</h3>
              <p className={styles.emptyText}>
                Start building your collection by adding bottles or importing from CSV
              </p>
              <Button variant="primary" size="md">
                ➕ Add Your First Bottle
              </Button>
            </div>
          </Card>
        ) : (
          <Card padding="none" className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Brand</th>
                    <th>ABV</th>
                    <th>Quantity</th>
                    <th>Profile</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBottles.map((bottle, index) => (
                    <tr
                      key={bottle.id}
                      className={index % 2 === 0 ? styles.evenRow : styles.oddRow}
                    >
                      <td className={styles.nameCell}>{bottle.name}</td>
                      <td>{bottle['Liquor Type'] || '-'}</td>
                      <td>{bottle.Brand || '-'}</td>
                      <td>{bottle['ABV (%)'] ? `${bottle['ABV (%)']}%` : '-'}</td>
                      <td>
                        {bottle['Quantity (ml)']
                          ? `${bottle['Quantity (ml)']} ml`
                          : '-'}
                      </td>
                      <td className={styles.profileCell}>
                        {bottle['Profile (Nose)'] || '-'}
                      </td>
                      <td className={styles.actionsCell}>
                        <button
                          className={styles.actionBtn}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => bottle.id && handleDelete(bottle.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
