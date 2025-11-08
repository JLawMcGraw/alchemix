'use client';

import { useState, useEffect } from 'react';
import { Edit2, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { Bottle } from '@/types';
import styles from './BottleFormModal.module.css';

interface EditBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: Bottle | null;
  onUpdate: (id: number, bottle: Partial<Bottle>) => Promise<void>;
}

export function EditBottleModal({ isOpen, onClose, bottle, onUpdate }: EditBottleModalProps) {
  const [formData, setFormData] = useState({
    Spirit: '',
    Brand: '',
    'Age/Type': '',
    'Quantity (ml)': '',
    'Cost ($)': '',
    'Date Added': '',
    'Date Opened': '',
    'Estimated Remaining (ml)': '',
    'Restock Threshold (ml)': '',
    Location: '',
    'Tasting Notes': '',
    Tags: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bottle) {
      setFormData({
        Spirit: bottle.Spirit || '',
        Brand: bottle.Brand || '',
        'Age/Type': bottle['Age/Type'] || '',
        'Quantity (ml)': bottle['Quantity (ml)']?.toString() || '',
        'Cost ($)': bottle['Cost ($)']?.toString() || '',
        'Date Added': bottle['Date Added'] || '',
        'Date Opened': bottle['Date Opened'] || '',
        'Estimated Remaining (ml)': bottle['Estimated Remaining (ml)']?.toString() || '',
        'Restock Threshold (ml)': bottle['Restock Threshold (ml)']?.toString() || '200',
        Location: bottle.Location || '',
        'Tasting Notes': bottle['Tasting Notes'] || '',
        Tags: bottle.Tags || '',
      });
    }
  }, [bottle]);

  if (!isOpen || !bottle) return null;

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updates: Partial<Bottle> = {
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

      await onUpdate(bottle.id!, updates);
      handleClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update bottle');
      } else {
        setError('Failed to update bottle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Edit2 size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            Edit Bottle
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
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
