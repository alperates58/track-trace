import React from 'react';

export interface TTLoadingStateProps {
  text?: string;
}

export const TTLoadingState: React.FC<TTLoadingStateProps> = ({ text = 'Yükleniyor...' }) => {
  return (
    <div className="tt-loading-state">
      <div className="tt-spinner-large" />
      {text && <p className="tt-loading-text">{text}</p>}
    </div>
  );
};
