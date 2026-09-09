import React from 'react';

export interface TTUserAvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  role?: string;
}

export const TTUserAvatar: React.FC<TTUserAvatarProps> = ({ 
  name = 'U', 
  size = 'md', 
  isActive,
  role
}) => {
  const initial = name.charAt(0).toUpperCase();
  const sizeClasses = `tt-avatar-${size}`;
  const roleClass = role ? `tt-avatar-role-${role.toLowerCase()}` : '';
  
  return (
    <div className={`tt-avatar ${sizeClasses} ${roleClass}`}>
      {initial}
      {isActive !== undefined && (
        <span className={`tt-avatar-status ${isActive ? 'online' : 'offline'}`} />
      )}
    </div>
  );
};
