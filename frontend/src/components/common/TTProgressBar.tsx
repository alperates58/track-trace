import React from 'react';

export interface TTProgressBarProps {
  progress: number;
  label?: string;
  showValue?: boolean;
  color?: string;
}

export const TTProgressBar: React.FC<TTProgressBarProps> = ({
  progress,
  label,
  showValue = false,
  color = 'var(--primary)'
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className="tt-progress-container">
      {(label || showValue) && (
        <div className="tt-progress-header">
          {label && <span className="tt-progress-label">{label}</span>}
          {showValue && <span className="tt-progress-value">{clampedProgress}%</span>}
        </div>
      )}
      <div className="tt-progress-track">
        <div 
          className="tt-progress-fill" 
          style={{ width: `${clampedProgress}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
