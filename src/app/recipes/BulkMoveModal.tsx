'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Collection } from '@/types';
import styles from './recipes.module.css';

interface BulkMoveModalProps {
  isOpen: boolean;
  selectedCount: number;
  collections: Collection[];
  selectedCollectionId: number | null;
  onCollectionChange: (collectionId: number | null) => void;
  onClose: () => void;
  onConfirm: () => void;
  onCreateAndMove?: (name: string) => Promise<void>;
}

export function BulkMoveModal({
  isOpen,
  selectedCount,
  collections,
  selectedCollectionId,
  onCollectionChange,
  onClose,
  onConfirm,
  onCreateAndMove,
}: BulkMoveModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsCreating(false);
    setNewCollectionName('');
    onClose();
  };

  const handleCreateAndMove = async () => {
    if (!newCollectionName.trim() || !onCreateAndMove) return;
    setIsSubmitting(true);
    try {
      await onCreateAndMove(newCollectionName.trim());
      setIsCreating(false);
      setNewCollectionName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.bulkMoveOverlay} onClick={handleClose}>
      <div className={styles.bulkMoveModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.bulkMoveTitle}>
          Move {selectedCount} Recipe{selectedCount !== 1 ? 's' : ''}
        </h3>

        {!isCreating ? (
          <>
            <select
              value={selectedCollectionId ?? ''}
              onChange={(e) =>
                onCollectionChange(e.target.value ? parseInt(e.target.value, 10) : null)
              }
              className={styles.bulkMoveSelect}
            >
              <option value="">Uncategorized</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>

            {onCreateAndMove && (
              <button
                type="button"
                className={styles.createCollectionBtn}
                onClick={() => setIsCreating(true)}
              >
                <Plus size={14} />
                Create New Collection
              </button>
            )}

            <div className={styles.bulkMoveActions}>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={onConfirm}>
                Move
              </Button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Collection name"
              className={styles.bulkMoveInput}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCollectionName.trim()) {
                  handleCreateAndMove();
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewCollectionName('');
                }
              }}
            />

            <div className={styles.bulkMoveActions}>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewCollectionName('');
                }}
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateAndMove}
                disabled={!newCollectionName.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create & Move'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
