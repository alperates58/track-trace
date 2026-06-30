import React from 'react';
import { TTCard } from './TTCard';

export interface TTStatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  color?: string;
}

export const TTStatCard: React.FC<TTStatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'var(--primary)'
}) => {
  return (
    <TTCard className="tt-stat-card" padding="md">
      <div className="tt-stat-header">
        <h4 className="tt-stat-title">{title}</h4>
        {icon && (
          <div className="tt-stat-icon" style={{ backgroundColor: `${color}15`, color }}>
            {icon}
          </div>
        )}
      </div>
      <div className="tt-stat-value">{value}</div>
      {trend && (
        <div className={`tt-stat-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          <span className="tt-stat-trend-val">{trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%</span>
          <span className="tt-stat-trend-label">{trend.label}</span>
        </div>
      )}
    </TTCard>
  );
};
