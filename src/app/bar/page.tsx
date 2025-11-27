'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Wine, Upload, Plus, Martini, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { CSVUploadModal, AddBottleModal, ItemDetailModal } from '@/components/modals';
import { inventoryApi } from '@/lib/api';
import type { InventoryCategory, InventoryItem } from '@/types';
import { categorizeSpirit, matchesSpiritCategory, SpiritCategory } from '@/lib/spirits';
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
  const { inventoryItems, inventoryPagination, fetchItems, addItem, deleteItem } = useStore();
  const { showToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [spiritTypeFilter, setSpiritTypeFilter] = useState<SpiritCategory | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Handle URL parameters
  useEffect(() => {
    const category = searchParams.get('category');
    if (category && CATEGORIES.find(c => c.id === category)) {
      setActiveCategory(category as InventoryCategory | 'all');
    }
  }, [searchParams]);

  // Fetch category counts on mount
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      inventoryApi.getCategoryCounts()
        .then(counts => {
          console.log('📊 Category counts received:', counts);
          setCategoryCounts(counts);
        })
        .catch(err => {
          console.error('❌ Failed to fetch category counts:', err);
        });
    }
  }, [isAuthenticated, isValidating]);

  // Fetch items when category or page changes (server-side filtering + pagination)
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchItems(currentPage, 50, activeCategory).catch(console.error);
      // Clear selections when page/category changes
      setSelectedIds(new Set());
    }
  }, [isAuthenticated, isValidating, currentPage, activeCategory]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Ensure inventoryItems is always an array
  const itemsArray = Array.isArray(inventoryItems) ? inventoryItems : [];

  // Apply client-side spirit type filter only (category filtering is server-side)
  let filteredItems = itemsArray;
  if (spiritTypeFilter) {
    filteredItems = filteredItems.filter(item =>
      matchesSpiritCategory(item.type, spiritTypeFilter)
    );
  }

  // Get category count from fetched counts
  const getCategoryCount = (categoryId: InventoryCategory | 'all') => {
    return categoryCounts[categoryId] || 0;
  };

  // Modal handlers
  const handleCSVUpload = async (file: File) => {
    try {
      console.log('🔄 Starting CSV import...');
      const result = await inventoryApi.importCSV(file);
      console.log('✅ CSV import result:', result);
      console.log('🔄 Fetching items after import...');
      await fetchItems();
      // Refresh category counts
      const counts = await inventoryApi.getCategoryCounts();
      setCategoryCounts(counts);
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
      // Refresh category counts
      const counts = await inventoryApi.getCategoryCounts();
      setCategoryCounts(counts);
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

  // Selection handlers
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible items
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      await inventoryApi.deleteBulk(idsArray);

      // Refresh items and counts
      await fetchItems(currentPage, 50, activeCategory);
      const counts = await inventoryApi.getCategoryCounts();
      setCategoryCounts(counts);

      showToast('success', `Successfully deleted ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk delete error:', error);
      showToast('error', 'Failed to delete items');
    } finally {
      setIsDeleting(false);
    }
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
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className={styles.deleteButton}
                >
                  <Trash2 size={18} />
                  Delete Selected ({selectedIds.size})
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Cancel
                </Button>
              </>
            )}
            {selectedIds.size === 0 && (
              <>
                <Button variant="outline" size="md" onClick={() => setCsvModalOpen(true)}>
                  <Upload size={18} />
                  Import CSV
                </Button>
                <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
                  <Plus size={18} />
                  Add Item
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bulk Selection Controls */}
        {filteredItems.length > 0 && (
          <div className={styles.bulkControls}>
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                onChange={toggleSelectAll}
                className={styles.checkbox}
              />
              <span>
                {selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? `All ${filteredItems.length} items selected`
                  : 'Select all'}
              </span>
            </label>
          </div>
        )}

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
                  setCurrentPage(1); // Reset to page 1 when changing category
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
          // Count by categorized spirit type
          const spiritCounts = spiritItems.reduce((acc, item) => {
            const category = categorizeSpirit(item.type);
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {} as Record<SpiritCategory, number>);

          // Sort by count descending
          const sortedSpirits = Object.entries(spiritCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6); // Top 6 spirit categories

          // Handler to filter by spirit type
          const handleSpiritClick = (spiritType: string) => {
            setActiveCategory('spirit'); // Switch to Spirits tab
            setSpiritTypeFilter(spiritType as SpiritCategory); // Set the spirit type filter
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
                className={`${styles.itemCard} ${selectedIds.has(item.id) ? styles.itemCardSelected : ''}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(item.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.checkbox}
                    />
                    <h3
                      className={styles.itemName}
                      onClick={() => handleCardClick(item)}
                    >
                      {item.name}
                    </h3>
                  </div>
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
                  <span className={styles.stockNumber}>
                    Stock: {item['Stock Number'] ?? 0}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {inventoryPagination && inventoryPagination.totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={!inventoryPagination.hasPreviousPage}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>

            <span className={styles.paginationInfo}>
              Page {inventoryPagination.page} of {inventoryPagination.totalPages}
              {' '}({inventoryPagination.total} items)
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(inventoryPagination.totalPages, prev + 1))}
              disabled={!inventoryPagination.hasNextPage}
            >
              Next
              <ChevronRight size={16} />
            </Button>
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
