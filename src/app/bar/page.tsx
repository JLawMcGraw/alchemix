'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Wine, Upload, Plus, Edit2, Trash2, Martini } from 'lucide-react';
import { CSVUploadModal, AddBottleModal, EditBottleModal, DeleteConfirmModal } from '@/components/modals';
import { inventoryApi } from '@/lib/api';
import type { Bottle } from '@/types';
import styles from './bar.module.css';

export default function BarPage() {
  const router = useRouter();
  const { isAuthenticated, bottles, fetchBottles, addBottle, updateBottle, deleteBottle } = useStore();
  const { showToast } = useToast();
  const [filterType, setFilterType] = useState<string>('all');

  // Modal states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(null);

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

  // Ensure bottles is always an array
  const bottlesArray = Array.isArray(bottles) ? bottles : [];

  // Get unique liquor types for filter
  const liquorTypes = ['all', ...new Set(bottlesArray.map((b) => b['Liquor Type']).filter(Boolean))];

  // Filter bottles
  const filteredBottles =
    filterType === 'all'
      ? bottlesArray
      : bottlesArray.filter((b) => b['Liquor Type'] === filterType);

  // Modal handlers
  const handleCSVUpload = async (file: File) => {
    try {
      console.log('🔄 Starting CSV import...');
      const result = await inventoryApi.importCSV(file);
      console.log('✅ CSV import result:', result);
      if (result.errors && result.errors.length > 0) {
        console.warn('⚠️ Import had validation errors:');
        result.errors.slice(0, 5).forEach((err: any) => {
          console.warn(`  Row ${err.row}: ${err.error}`);
        });
      }
      console.log('🔄 Fetching bottles after import...');
      await fetchBottles();
      console.log('✅ Bottles fetched successfully');
      if (result.imported > 0) {
        showToast('success', `Successfully imported ${result.imported} bottles from CSV`);
      } else {
        showToast('error', `CSV import failed: ${result.failed} rows had errors. Check console for details.`);
      }
    } catch (error) {
      console.error('❌ CSV import error:', error);
      showToast('error', 'Failed to import CSV');
      throw error;
    }
  };

  const handleAddBottle = async (bottle: Omit<Bottle, 'id'>) => {
    try {
      await addBottle(bottle);
      showToast('success', 'Bottle added successfully');
    } catch (error) {
      showToast('error', 'Failed to add bottle');
      throw error;
    }
  };

  const handleEditBottle = async (id: number, updates: Partial<Bottle>) => {
    try {
      await updateBottle(id, updates);
      showToast('success', 'Bottle updated successfully');
    } catch (error) {
      showToast('error', 'Failed to update bottle');
      throw error;
    }
  };

  const handleDeleteBottle = async () => {
    if (selectedBottle?.id) {
      try {
        await deleteBottle(selectedBottle.id);
        showToast('success', 'Bottle deleted successfully');
      } catch (error) {
        showToast('error', 'Failed to delete bottle');
        throw error;
      }
    }
  };

  const openEditModal = (bottle: Bottle) => {
    setSelectedBottle(bottle);
    setEditModalOpen(true);
  };

  const openDeleteModal = (bottle: Bottle) => {
    setSelectedBottle(bottle);
    setDeleteModalOpen(true);
  };

  return (
    <div className={styles.barPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <Wine size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
              My Bar
            </h1>
            <p className={styles.subtitle}>
              {filteredBottles.length} {filteredBottles.length === 1 ? 'bottle' : 'bottles'}
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="outline" size="md" onClick={() => setCsvModalOpen(true)}>
              <Upload size={18} />
              Import CSV
            </Button>
            <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
              <Plus size={18} />
              Add Bottle
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
              <Martini size={64} className={styles.emptyIcon} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>Your bar is empty</h3>
              <p className={styles.emptyText}>
                Start building your collection by adding bottles or importing from CSV
              </p>
              <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
                <Plus size={18} />
                Add Your First Bottle
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
                          onClick={() => openEditModal(bottle)}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => openDeleteModal(bottle)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Modals */}
        <CSVUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          type="bottles"
          onUpload={handleCSVUpload}
        />

        <AddBottleModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAddBottle}
        />

        <EditBottleModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          bottle={selectedBottle}
          onUpdate={handleEditBottle}
        />

        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteBottle}
          title="Delete Bottle?"
          message="Are you sure you want to delete this bottle from your inventory?"
          itemName={selectedBottle ? `${selectedBottle.Spirit} - ${selectedBottle.Brand}` : ''}
        />
      </div>
    </div>
  );
}
