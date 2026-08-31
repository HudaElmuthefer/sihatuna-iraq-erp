// frontend/src/components/AppLogo.js
//
// Renders the uploaded organization logo if one exists (AppContext.logoUrl),
// falling back to the built-in SIHATUNA IRAQ icon otherwise. Used in the
// sidebar header, the login page, every PageBanner, and the print-only
// header block — never a broken <img>, since onError below drops back to
// the icon if the file 404s.
import React, { useState, useEffect } from 'react';
import { FaHospitalSymbol } from 'react-icons/fa';
import { useApp } from '../contexts/AppContext';

export default function AppLogo({ size = 38, radius = 10, fontSize }) {
  const { logoUrl } = useApp();
  const [imgFailed, setImgFailed] = useState(false);
  // Reset the failed flag whenever the logo changes (e.g. a broken upload
  // gets replaced with a good one) so it isn't stuck showing the fallback.
  useEffect(() => { setImgFailed(false); }, [logoUrl]);

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt="Logo"
        onError={() => setImgFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: 'linear-gradient(135deg,#1a6bab,#0d3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontSize || Math.round(size * 0.53), color: '#fff', flexShrink: 0 }}>
      <FaHospitalSymbol />
    </div>
  );
}
