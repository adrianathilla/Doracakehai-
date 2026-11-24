import React, { useState } from 'react';
import { CakeSlice } from 'lucide-react';
import { safeImageSrc } from '../utils/format';

interface ResilientImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);
  const validSrc = safeImageSrc(src);

  if (!validSrc || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FBF6EE] via-[#F2E7D6] to-[#E6D8C5] text-[#6E5849] ${className}`}
        role="img"
        aria-label={alt}
      >
        <CakeSlice className="h-8 w-8 text-[#9E7840] opacity-75" strokeWidth={1.5} />
        {fallbackLabel && (
          <span className="mt-2 max-w-[80%] truncate px-2 text-center text-xs font-medium text-[#6E5849]">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={validSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
