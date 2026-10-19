import React from 'react';

type BadgeTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'gray';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', className = '' }) => {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()}>
      {children}
    </span>
  );
};
