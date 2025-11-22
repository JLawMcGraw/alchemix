'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Wine, Upload, Plus, Martini, X } from 'lucide-react';
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

function BarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { inventoryItems, fetchItems, addItem, deleteItem } = useStore();
  const { showToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | 'all'>('all');

  // Modal states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [spiritTypeFilter, setSpiritTypeFilter] = useState<string | null>(null);

  // Handle URL parameters
  useEffect(() => {
    const category = searchParams.get('category');
    if (category && CATEGORIES.find(c => c.id === category)) {
      setActiveCategory(category as InventoryCategory | 'all');
    }
  }, [searchParams]);

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

  // Helper function to match spirit type with fuzzy categories
  const matchesSpiritType = (itemType: string | undefined, targetCategory: string): boolean => {
    if (!itemType) return false;

    const normalized = itemType.toLowerCase().trim();
    const spiritKeywords: Record<string, string[]> = {
      'Whiskey': ['whiskey', 'whisky', 'bourbon', 'scotch', 'rye', 'irish whiskey', 'japanese whisky'],
      'Rum': ['rum', 'rhum', 'ron', 'cachaça', 'cachaca'],
      'Gin': ['gin', 'genever'],
      'Vodka': ['vodka'],
      'Tequila': ['tequila', 'mezcal'],
      'Brandy': ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados'],
    };

    const keywords = spiritKeywords[targetCategory];
    if (!keywords) return false;

    return keywords.some(keyword => normalized.includes(keyword));
  };

  // Filter items by category and optionally by spirit type
  let filteredItems = activeCategory === 'all'
    ? itemsArray
    : itemsArray.filter((i) => i.category === activeCategory);

  // Apply spirit type filter if active
  if (spiritTypeFilter) {
    filteredItems = filteredItems.filter(item =>
      matchesSpiritType(item.type, spiritTypeFilter)
    );
  }

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
            <div className={styles.subtitleContainer}>
              <p className={styles.subtitle}>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                {spiritTypeFilter
                  ? ` - ${spiritTypeFilter}`
                  : activeCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === activeCategory)?.label}`
                }
              </p>
              {spiritTypeFilter && (
                <button
                  className={styles.clearFilterBtn}
                  onClick={() => setSpiritTypeFilter(null)}
                  title="Clear filter"
                >
                  <X size={16} />
                  Clear Filter
                </button>
              )}
            </div>
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
                onClick={() => {
                  setActiveCategory(category.id);
                  setSpiritTypeFilter(null); // Clear spirit filter when changing tabs
                }}
              >
                {category.label}
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Spirit Distribution - Show on "All" tab and when filtering spirits */}
        {(activeCategory === 'all' || activeCategory === 'spirit') && itemsArray.length > 0 && (() => {
          // Get spirit items only
          const spiritItems = itemsArray.filter(item => item.category === 'spirit');

          if (spiritItems.length === 0) return null;

          // Base spirit categories for fuzzy matching
          const spiritCategories: Record<string, string[]> = {
            'Whiskey': ['whiskey', 'whisky', 'bourbon', 'scotch', 'rye', 'irish whiskey', 'japanese whisky'],
            'Rum': ['rum', 'rhum', 'ron', 'cachaça', 'cachaca'],
            'Gin': ['gin', 'genever'],
            'Vodka': ['vodka'],
            'Tequila': ['tequila', 'mezcal'],
            'Brandy': ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados'],
            'Other Spirits': ['other', 'spirit', 'liquor']
          };

          // Function to categorize a spirit type
          const categorizeSpirit = (spiritType: string): string => {
            if (!spiritType) return 'Other Spirits';

            const normalized = spiritType.toLowerCase().trim();

            // Check each category for a match
            for (const [category, keywords] of Object.entries(spiritCategories)) {
              if (keywords.some(keyword => normalized.includes(keyword))) {
                return category;
              }
            }

            // If no match found, return the original type capitalized
            return spiritType;
          };

          // Count by categorized spirit type
          const spiritCounts = spiritItems.reduce((acc, item) => {
            const category = categorizeSpirit(item.type || 'Other Spirits');
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Sort by count descending
          const sortedSpirits = Object.entries(spiritCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6); // Top 6 spirit categories

          // Handler to filter by spirit type
          const handleSpiritClick = (spiritType: string) => {
            setActiveCategory('spirit'); // Switch to Spirits tab
            setSpiritTypeFilter(spiritType); // Set the spirit type filter
          };

          return (
            <Card padding="md" className={styles.spiritDistribution}>
              <h3 className={styles.spiritDistributionTitle}>
                <Wine size={18} style={{ marginRight: '8px' }} />
                Spirit Distribution
              </h3>
              <div className={styles.spiritGrid}>
                {sortedSpirits.map(([spirit, count]) => (
                  <button
                    key={spirit}
                    className={styles.spiritItem}
                    onClick={() => handleSpiritClick(spirit)}
                  >
                    <span className={styles.spiritName}>{spirit}</span>
                    <span className={styles.spiritCount}>{count}</span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })()}

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

export default function BarPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BarPageContent />
    </Suspense>
  );
}
