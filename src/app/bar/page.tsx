'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { BottleCard } from '@/components/BottleCard';
import { Wine, Upload, Plus, Martini, X, ChevronLeft, ChevronRight, Trash2, Grid3X3, List } from 'lucide-react';
import { CSVUploadModal, AddBottleModal, ItemDetailModal } from '@/components/modals';
// Periodic Table Version Toggle
// V1: Traditional element grid with sections (original)
// V2: 6x6 grid by function × origin (new design)
import { PeriodicTable as PeriodicTableV2 } from '@/components/PeriodicTableV2';
import { PeriodicTable as PeriodicTableV1 } from '@/components/PeriodicTable';
import { type PeriodicElement, elementToAddModalPreFill, type AddModalPreFill, itemMatchesElement } from '@/lib/periodicTable';
import { inventoryApi } from '@/lib/api';
import type { InventoryCategory, InventoryItem, InventoryItemInput } from '@/types';
import { categorizeSpirit, matchesSpiritCategory, SpiritCategory } from '@/lib/spirits';
import styles from './bar.module.css';

// Feature flag: Set to 'v1' or 'v2' to switch periodic table versions
// Can also be controlled via NEXT_PUBLIC_PERIODIC_TABLE_VERSION env var
const PERIODIC_TABLE_VERSION = process.env.NEXT_PUBLIC_PERIODIC_TABLE_VERSION || 'v1';
const PeriodicTable = PERIODIC_TABLE_VERSION === 'v2' ? PeriodicTableV2 : PeriodicTableV1;

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
  const { user, inventoryItems, inventoryPagination, fetchItems, addItem, deleteItem, isLoading } = useStore();
  const { showToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<InventoryCategory | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [spiritTypeFilter, setSpiritTypeFilter] = useState<SpiritCategory | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // View mode: 'periodic' (periodic table) or 'list' (traditional list)
  const [viewMode, setViewMode] = useState<'periodic' | 'list'>('periodic');

  // Periodic table element filter
  const [selectedElement, setSelectedElement] = useState<PeriodicElement | null>(null);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Pre-fill data for AddBottleModal when adding from periodic table element
  const [addModalPreFill, setAddModalPreFill] = useState<AddModalPreFill | null>(null);

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
          setCategoryCounts(counts);
        })
        .catch(() => {
          // Silently fail - category counts are non-critical
        });
    }
  }, [isAuthenticated, isValidating]);

  // Fetch items when category or page changes (server-side filtering + pagination)
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      const loadItems = async () => {
        try {
          await fetchItems(currentPage, 50, activeCategory);
          // Backfill periodic tags for items that don't have them
          if (!hasInitiallyLoaded) {
            const result = await inventoryApi.backfillPeriodicTags();
            if (result.updated > 0) {
              // Refetch to get updated tags
              await fetchItems(currentPage, 50, activeCategory);
            }
          }
        } catch {
          // Error handled by store
        } finally {
          setHasInitiallyLoaded(true);
        }
      };
      loadItems();
      // Clear selections when page/category changes
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchItems is stable, hasInitiallyLoaded intentionally excluded to run only once
  }, [isAuthenticated, isValidating, currentPage, activeCategory]);

  // Ensure inventoryItems is always an array - must be before useMemo hooks
  const itemsArray = useMemo(() => 
    Array.isArray(inventoryItems) ? inventoryItems : [],
    [inventoryItems]
  );

  // Apply client-side filters (category filtering is server-side)
  // useMemo must be called before any conditional returns
  const filteredItems = useMemo(() => {
    let items = itemsArray;

    // Filter by periodic table element if selected
    // Uses whole-word matching to prevent false positives (e.g., "ginger beer" matching "gin")
    if (selectedElement) {
      items = items.filter(item => {
        // Only show items that are in stock
        if (item.stock_number !== undefined && item.stock_number <= 0) {
          return false;
        }
        return itemMatchesElement(item, selectedElement);
      });
    }

    // Filter by spirit type if set
    if (spiritTypeFilter) {
      items = items.filter(item =>
        matchesSpiritCategory(item.type, spiritTypeFilter, item.name)
      );
    }

    return items;
  }, [itemsArray, spiritTypeFilter, selectedElement]);


  // Early return after all hooks have been called
  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Get category count from fetched counts
  const getCategoryCount = (categoryId: InventoryCategory | 'all') => {
    return categoryCounts[categoryId] || 0;
  };

  // Modal handlers
  const handleCSVUpload = async (file: File) => {
    try {
      const result = await inventoryApi.importCSV(file);

      // Backfill periodic tags for any items that need them
      await inventoryApi.backfillPeriodicTags();

      await fetchItems();
      // Refresh category counts
      const counts = await inventoryApi.getCategoryCounts();
      setCategoryCounts(counts);
      if (result.imported > 0) {
        showToast('success', `Successfully imported ${result.imported} items from CSV`);
      } else {
        showToast('error', 'CSV import failed');
      }
    } catch {
      showToast('error', 'Failed to import CSV');
    }
  };

  const handleAddItem = async (item: InventoryItemInput) => {
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

  // Handle adding a new item from periodic table element click
  const handleElementAdd = (element: PeriodicElement) => {
    const preFill = elementToAddModalPreFill(element);
    setAddModalPreFill(preFill);
    setAddModalOpen(true);
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
      // Select all visible items (filter out undefined IDs)
      setSelectedIds(new Set(filteredItems.map(item => item.id).filter((id): id is number => id !== undefined)));
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
    } catch {
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
            <h1 className={styles.title}>My Bar</h1>
            <div className={styles.subtitleContainer}>
              <p className={styles.subtitle}>
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                {selectedElement
                  ? ` - ${selectedElement.name}`
                  : spiritTypeFilter
                    ? ` - ${spiritTypeFilter}`
                    : activeCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === activeCategory)?.label}`
                }
              </p>
              {selectedElement && (
                <button
                  className={styles.clearFilterBtn}
                  onClick={() => setSelectedElement(null)}
                  title="Clear element filter"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
              {spiritTypeFilter && !selectedElement && (
                <button
                  className={styles.clearFilterBtn}
                  onClick={() => {
                    setSpiritTypeFilter(null);
                  }}
                  title="Clear filter"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            {/* View Toggle */}
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'periodic' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('periodic')}
                title="Periodic Table View"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>

            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} />
                  Delete ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost"
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
                  <Upload size={16} />
                  Import
                </Button>
                <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
                  <Plus size={16} />
                  Add Item
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Periodic Table View - Version controlled by PERIODIC_TABLE_VERSION constant above */}
        {viewMode === 'periodic' && (
          <PeriodicTable
            inventoryItems={itemsArray}
            selectedElement={selectedElement}
            onElementClick={(element) => setSelectedElement(element)}
            onElementAdd={handleElementAdd}
            onClearSelection={() => setSelectedElement(null)}
          />
        )}

        {/* List View - Category Tabs */}
        {viewMode === 'list' && (
          <>
            <div className={styles.tabs}>
              {CATEGORIES.map((category) => {
                const count = getCategoryCount(category.id);
                return (
                  <button
                    key={category.id}
                    className={`${styles.tab} ${activeCategory === category.id ? styles.tabActive : ''}`}
                    onClick={() => {
                      setActiveCategory(category.id);
                      setCurrentPage(1);
                      setSpiritTypeFilter(null);
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
              const spiritItems = itemsArray.filter(item => item.category === 'spirit');
              if (spiritItems.length === 0) return null;

              const spiritCounts = spiritItems.reduce((acc, item) => {
                const category = categorizeSpirit(item.type, item.name);
                acc[category] = (acc[category] || 0) + 1;
                return acc;
              }, {} as Record<SpiritCategory, number>);

              const sortedSpirits = Object.entries(spiritCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6);

              const handleSpiritClick = (spiritType: string) => {
                setActiveCategory('spirit');
                setSpiritTypeFilter(spiritType as SpiritCategory);
              };

              return (
                <Card padding="md" className={styles.spiritDistribution}>
                  <h3 className={styles.spiritDistributionTitle}>
                    <Wine size={16} />
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
          </>
        )}

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
              <span className={styles.selectAllText}>
                {selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? `All ${filteredItems.length} selected`
                  : 'Select all'}
              </span>
            </label>
          </div>
        )}

        {/* Items Grid */}
        {(isLoading && !hasInitiallyLoaded) ? (
          <Card padding="lg">
            <div className={styles.emptyState}>
              <div className={styles.loadingSpinner} />
              <h3 className={styles.emptyTitle}>Loading your bar...</h3>
            </div>
          </Card>
        ) : filteredItems.length === 0 ? (
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
                  ? 'Add a bottle and your Periodic Table of Mixology will build — organizing your ingredients by function and origin.'
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
            {filteredItems.map((item) => {
              if (!item.id) return null;
              return (
                <BottleCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onSelect={toggleSelection}
                  onClick={handleCardClick}
                />
              );
            })}
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
          onClose={() => {
            setAddModalOpen(false);
            setAddModalPreFill(null);
          }}
          onAdd={handleAddItem}
          preFill={addModalPreFill}
        />

        <ItemDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          item={selectedItem}
          onItemUpdated={(updatedItem) => setSelectedItem(updatedItem)}
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
