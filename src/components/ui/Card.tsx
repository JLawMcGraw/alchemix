// Card Component
// Container with surface background and shadow

import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
  style,
}) => {
  const classNames = [
    styles.card,
    styles[`padding-${padding}`],
    hover ? styles.hover : '',
    onClick ? styles.clickable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} onClick={onClick} style={style}>
      {children}
    </div>
  );
};
