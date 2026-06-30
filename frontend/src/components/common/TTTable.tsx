import React from 'react';

export interface TTTableProps {
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}

export const TTTable: React.FC<TTTableProps> = ({ headers, children, className = '' }) => {
  return (
    <div className={`tt-table-container ${className}`}>
      <table className="tt-table">
        <thead>
          <tr>
            {headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
};
