'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { Collection } from '@/types';

interface BulkMoveModalProps {
  isOpen: boolean;
  selectedCount: number;
  collections: Collection[];
  selectedCollectionId: number | null;
  onCollectionChange: (collectionId: number | null) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function BulkMoveModal({
  isOpen,
  selectedCount,
  collections,
  selectedCollectionId,
  onCollectionChange,
  onClose,
  onConfirm,
}: BulkMoveModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '2px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '16px',
            color: 'var(--color-text-body)',
          }}
        >
          Move {selectedCount} Recipe(s)
        </h3>
        <select
          value={selectedCollectionId ?? ''}
          onChange={(e) =>
            onCollectionChange(e.target.value ? parseInt(e.target.value, 10) : null)
          }
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            marginBottom: '20px',
          }}
        >
          <option value="">Uncategorized</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Move Recipes
          </Button>
        </div>
      </div>
    </div>
  );
}
