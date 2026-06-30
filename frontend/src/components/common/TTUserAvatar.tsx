import React from 'react';

export interface TTUserAvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
}

export const TTUserAvatar: React.FC<TTUserAvatarProps> = ({ 
  name = 'U', 
  size = 'md', 
  isActive 
}) => {
  const initial = name.charAt(0).toUpperCase();
  const sizeClasses = `tt-avatar-${size}`;
  
  return (
    <div className={`tt-avatar ${sizeClasses}`}>
      {initial}
      {isActive !== undefined && (
        <span className={`tt-avatar-status ${isActive ? 'online' : 'offline'}`} />
      )}
    </div>
  );
};
