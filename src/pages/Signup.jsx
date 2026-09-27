import React from 'react';
import Auth from './Auth';

export default function Signup({ onBack }) {
  return <Auth initialMode="signup" onBack={onBack} />;
}
