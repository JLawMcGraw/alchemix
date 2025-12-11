'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import styles from './GlassSelector.module.css';

const DEFAULT_GLASSES = ['Coupe', 'Rocks', 'Highball', 'Nick & Nora', 'Martini', 'Collins', 'Tiki Mug'];

interface GlassSelectorProps {
  value: string;
  onChange: (glass: string) => void;
}

export function GlassSelector({ value, onChange }: GlassSelectorProps) {
  const { customGlasses, fetchCustomGlasses, addCustomGlass, deleteCustomGlass } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newGlass, setNewGlass] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch custom glasses on mount
  useEffect(() => {
    fetchCustomGlasses().catch(console.error);
  }, [fetchCustomGlasses]);

  const handleAddGlass = async () => {
    const trimmed = newGlass.trim();
    if (!trimmed) return;

    // Check if already exists in defaults or customs
    const allGlasses = [...DEFAULT_GLASSES, ...customGlasses.map(g => g.name)];
    if (allGlasses.some(g => g.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    setIsLoading(true);
    try {
      const glass = await addCustomGlass(trimmed);
      onChange(glass.name);
      setNewGlass('');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add glass:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGlass = async (glassId: number, glassName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCustomGlass(glassId);
      if (value === glassName) {
        onChange('');
      }
    } catch (error) {
      console.error('Failed to delete glass:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddGlass();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewGlass('');
    }
  };

  const allGlasses = [
    ...DEFAULT_GLASSES.map(name => ({ id: null, name, isCustom: false })),
    ...customGlasses.map(g => ({ id: g.id, name: g.name, isCustom: true })),
  ];

  return (
    <div className={styles.glassGrid}>
      {allGlasses.map((glass) => {
        const isSelected = value === glass.name;

        return (
          <button
            key={glass.isCustom ? `custom-${glass.id}` : glass.name}
            type="button"
            className={`${styles.glassOption} ${isSelected ? styles.glassOptionSelected : ''}`}
            onClick={() => onChange(value === glass.name ? '' : glass.name)}
          >
            {glass.name}
            {glass.isCustom && glass.id && (
              <span
                className={styles.deleteIcon}
                onClick={(e) => handleDeleteGlass(glass.id!, glass.name, e)}
                title="Remove glass type"
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}

      {isAdding ? (
        <div className={styles.addInputWrapper}>
          <input
            type="text"
            value={newGlass}
            onChange={(e) => setNewGlass(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!newGlass.trim()) {
                setIsAdding(false);
              }
            }}
            className={styles.addInput}
            placeholder="Glass name"
            autoFocus
            disabled={isLoading}
          />
          <button
            type="button"
            className={styles.addConfirmBtn}
            onClick={handleAddGlass}
            disabled={!newGlass.trim() || isLoading}
          >
            {isLoading ? '...' : 'Add'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setIsAdding(true)}
        >
          <Plus size={14} />
          Add
        </button>
      )}
    </div>
  );
}
