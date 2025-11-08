'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { Bottle } from '@/types';
import styles from './BottleFormModal.module.css';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (bottle: Omit<Bottle, 'id'>) => Promise<void>;
}

export function AddBottleModal({ isOpen, onClose, onAdd }: AddBottleModalProps) {
  const [formData, setFormData] = useState({
    Spirit: '',
    Brand: '',
    'Age/Type': '',
    'Quantity (ml)': '',
    'Cost ($)': '',
    'Date Added': new Date().toISOString().split('T')[0],
    'Date Opened': '',
    'Estimated Remaining (ml)': '',
    'Restock Threshold (ml)': '200',
    Location: '',
    'Tasting Notes': '',
    Tags: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert string inputs to numbers where needed
      const bottle: Omit<Bottle, 'id'> = {
        Spirit: formData.Spirit,
        Brand: formData.Brand,
        'Age/Type': formData['Age/Type'],
        'Quantity (ml)': parseFloat(formData['Quantity (ml)']) || 0,
        'Cost ($)': parseFloat(formData['Cost ($)']) || 0,
        'Date Added': formData['Date Added'],
        'Date Opened': formData['Date Opened'] || null,
        'Estimated Remaining (ml)': parseFloat(formData['Estimated Remaining (ml)']) || null,
        'Restock Threshold (ml)': parseFloat(formData['Restock Threshold (ml)']) || 200,
        Location: formData.Location || null,
        'Tasting Notes': formData['Tasting Notes'] || null,
        Tags: formData.Tags || null,
      };

      await onAdd(bottle);
      handleClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to add bottle');
      } else {
        setError('Failed to add bottle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      Spirit: '',
      Brand: '',
      'Age/Type': '',
      'Quantity (ml)': '',
      'Cost ($)': '',
      'Date Added': new Date().toISOString().split('T')[0],
      'Date Opened': '',
      'Estimated Remaining (ml)': '',
      'Restock Threshold (ml)': '200',
      Location: '',
      'Tasting Notes': '',
      Tags: '',
    });
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Plus size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            Add New Bottle
          </h2>
          <button className={styles.closeBtn} onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.content}>
            <div className={styles.formGrid}>
              {/* Required Fields */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Basic Information</h3>
                <Input
                  label="Spirit Type *"
                  value={formData.Spirit}
                  onChange={(e) => handleChange('Spirit', e.target.value)}
                  placeholder="e.g., Whiskey, Rum, Gin"
                  required
                  fullWidth
                />
                <Input
                  label="Brand *"
                  value={formData.Brand}
                  onChange={(e) => handleChange('Brand', e.target.value)}
                  placeholder="e.g., Maker's Mark"
                  required
                  fullWidth
                />
                <Input
                  label="Age/Type"
                  value={formData['Age/Type']}
                  onChange={(e) => handleChange('Age/Type', e.target.value)}
                  placeholder="e.g., 12 Year, VSOP"
                  fullWidth
                />
              </div>

              {/* Quantity & Cost */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Quantity & Cost</h3>
                <div className={styles.formRow}>
                  <Input
                    label="Quantity (ml) *"
                    type="number"
                    value={formData['Quantity (ml)']}
                    onChange={(e) => handleChange('Quantity (ml)', e.target.value)}
                    placeholder="750"
                    required
                    fullWidth
                  />
                  <Input
                    label="Cost ($)"
                    type="number"
                    step="0.01"
                    value={formData['Cost ($)']}
                    onChange={(e) => handleChange('Cost ($)', e.target.value)}
                    placeholder="45.00"
                    fullWidth
                  />
                </div>
                <div className={styles.formRow}>
                  <Input
                    label="Estimated Remaining (ml)"
                    type="number"
                    value={formData['Estimated Remaining (ml)']}
                    onChange={(e) => handleChange('Estimated Remaining (ml)', e.target.value)}
                    placeholder="Leave empty if unopened"
                    fullWidth
                  />
                  <Input
                    label="Restock Threshold (ml)"
                    type="number"
                    value={formData['Restock Threshold (ml)']}
                    onChange={(e) => handleChange('Restock Threshold (ml)', e.target.value)}
                    placeholder="200"
                    fullWidth
                  />
                </div>
              </div>

              {/* Dates & Location */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Dates & Location</h3>
                <div className={styles.formRow}>
                  <Input
                    label="Date Added *"
                    type="date"
                    value={formData['Date Added']}
                    onChange={(e) => handleChange('Date Added', e.target.value)}
                    required
                    fullWidth
                  />
                  <Input
                    label="Date Opened"
                    type="date"
                    value={formData['Date Opened']}
                    onChange={(e) => handleChange('Date Opened', e.target.value)}
                    fullWidth
                  />
                </div>
                <Input
                  label="Location"
                  value={formData.Location}
                  onChange={(e) => handleChange('Location', e.target.value)}
                  placeholder="e.g., Top shelf, Cabinet A"
                  fullWidth
                />
              </div>

              {/* Notes & Tags */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Additional Details</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Tasting Notes</label>
                  <textarea
                    className={styles.textarea}
                    value={formData['Tasting Notes']}
                    onChange={(e) => handleChange('Tasting Notes', e.target.value)}
                    placeholder="Notes about flavor, aroma, etc."
                    rows={3}
                  />
                </div>
                <Input
                  label="Tags"
                  value={formData.Tags}
                  onChange={(e) => handleChange('Tags', e.target.value)}
                  placeholder="e.g., smooth, smoky, gift"
                  fullWidth
                />
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Bottle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
