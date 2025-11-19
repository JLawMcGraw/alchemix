'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Wine, Upload, Plus, Martini } from 'lucide-react';
import { CSVUploadModal, AddBottleModal, ItemDetailModal } from '@/components/modals';
import { inventoryApi } from '@/lib/api';
import type { InventoryCategory, InventoryItem } from '@/types';
import styles from './bar.module.css';

type CategoryTab = {
  id: InventoryCategory | 'all';
  label: string;
  icon: typeof Wine;
};

// Category definitions
const CATEGORIES: CategoryTab[] = [
  { id: 'all', label: 'All Items', icon: Wine },
  { id: 'spirit', label: 'Spirits', icon: Wine },
  { id: 'liqueur', label: 'Liqueurs', icon: Wine },
  { id: 'mixer', label: 'Mixers', icon: Wine },
  { id: 'syrup', label: 'Syrups', icon: Wine },
  { id: 'garnish', label: 'Garnishes', icon: Wine },
  { id: 'wine', label: 'Wine', icon: Wine },
  { id: 'beer', label: 'Beer', icon: Wine },
  { id: 'other', label: 'Other', icon: Wine },
];

export default function BarPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { inventoryItems, fetchItems, addItem, deleteItem } = useStore();
  const { showToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | 'all'>('all');

  // Modal states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchItems().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchItems]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Ensure inventoryItems is always an array
  const itemsArray = Array.isArray(inventoryItems) ? inventoryItems : [];

  // Filter items by category
  const filteredItems =
    activeCategory === 'all'
      ? itemsArray
      : itemsArray.filter((i) => i.category === activeCategory);

  // Get count for each category
  const getCategoryCount = (categoryId: InventoryCategory | 'all') => {
    if (categoryId === 'all') return itemsArray.length;
    return itemsArray.filter((i) => i.category === categoryId).length;
  };

  // Modal handlers
  const handleCSVUpload = async (file: File) => {
    try {
      console.log('🔄 Starting CSV import...');
      const result = await inventoryApi.importCSV(file);
      console.log('✅ CSV import result:', result);
      console.log('🔄 Fetching items after import...');
      await fetchItems();
      console.log('✅ Items fetched successfully');
      if (result.imported > 0) {
        showToast('success', `Successfully imported ${result.imported} items from CSV`);
      } else {
        showToast('error', 'CSV import failed. Check console for details.');
      }
    } catch (error) {
      console.error('❌ CSV import error:', error);
      showToast('error', 'Failed to import CSV');
      throw error;
    }
  };

  const handleAddItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      await addItem(item);
      showToast('success', 'Item added successfully');
    } catch (error) {
      showToast('error', 'Failed to add item');
      throw error;
    }
  };

  const handleCardClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
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
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
              {activeCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === activeCategory)?.label}`}
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="outline" size="md" onClick={() => setCsvModalOpen(true)}>
              <Upload size={18} />
              Import CSV
            </Button>
            <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
              <Plus size={18} />
              Add Item
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className={styles.tabs}>
          {CATEGORIES.map((category) => {
            const count = getCategoryCount(category.id);
            return (
              <button
                key={category.id}
                className={`${styles.tab} ${activeCategory === category.id ? styles.tabActive : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <Card padding="lg">
            <div className={styles.emptyState}>
              <Martini size={64} className={styles.emptyIcon} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>
                {activeCategory === 'all'
                  ? 'Your bar is empty'
                  : `No ${CATEGORIES.find(c => c.id === activeCategory)?.label.toLowerCase()} yet`
                }
              </h3>
              <p className={styles.emptyText}>
                {activeCategory === 'all'
                  ? 'Start building your collection by adding items or importing from CSV'
                  : `Add ${CATEGORIES.find(c => c.id === activeCategory)?.label.toLowerCase()} to your bar`
                }
              </p>
              <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
                <Plus size={18} />
                Add Your First Item
              </Button>
            </div>
          </Card>
        ) : (
          <div className={styles.itemsGrid}>
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                padding="md"
                hover
                className={styles.itemCard}
                onClick={() => handleCardClick(item)}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <span className={styles.categoryBadge}>
                    {item.category}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  {item.type && (
                    <div className={styles.itemDetail}>
                      <span className={styles.detailLabel}>Type:</span>
                      <span className={styles.detailValue}>{item.type}</span>
                    </div>
                  )}

                  {item.abv && (
                    <div className={styles.itemDetail}>
                      <span className={styles.detailLabel}>ABV:</span>
                      <span className={styles.detailValue}>
                        {item.abv}{item.abv.toString().includes('%') ? '' : '%'}
                      </span>
                    </div>
                  )}

                  {item['Profile (Nose)'] && (
                    <div className={styles.itemDetail}>
                      <span className={styles.detailLabel}>Profile:</span>
                      <span className={styles.detailValue}>{item['Profile (Nose)']}</span>
                    </div>
                  )}

                  {item['Distillery Location'] && (
                    <div className={styles.itemDetail}>
                      <span className={styles.detailLabel}>Location:</span>
                      <span className={styles.detailValue}>{item['Distillery Location']}</span>
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.cardHint}>Click to view details</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modals */}
        <CSVUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          type="items"
          onUpload={handleCSVUpload}
        />

        <AddBottleModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAddItem}
        />

        <ItemDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          item={selectedItem}
        />
      </div>
    </div>
  );
}
