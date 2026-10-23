import React, { useState } from 'react';
import { Eye, EyeOff } from '../Icons';

export const GlassInputWrapper = ({ children, className = '' }) => (
  <div className={`glass-input-wrapper ${className}`}>
    {children}
  </div>
);

export const FeatureCard = ({ icon: Icon, title, handle, text, delay = '' }) => (
  <div className={`floating-feature-card ${delay}`}>
    <div className="feature-card-icon-wrap">
      {Icon && <Icon size={20} />}
    </div>
    <div className="feature-card-text">
      <p className="feature-card-title">{title}</p>
      <p className="feature-card-handle">{handle}</p>
      <p className="feature-card-body">{text}</p>
    </div>
  </div>
);
