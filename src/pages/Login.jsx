import React from 'react';
import Auth from './Auth';

export default function Login({ onBack }) {
  return <Auth initialMode="login" onBack={onBack} />;
}
