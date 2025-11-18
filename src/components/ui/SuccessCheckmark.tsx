// Success Checkmark Animation
// Shows animated checkmark on successful actions

import React from 'react';
import { CheckCircle } from 'lucide-react';
import styles from './SuccessCheckmark.module.css';

interface SuccessCheckmarkProps {
  message?: string;
  onComplete?: () => void;
}

export const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = ({
  message = 'Success!',
  onComplete,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <CheckCircle size={64} className={styles.icon} />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
};
