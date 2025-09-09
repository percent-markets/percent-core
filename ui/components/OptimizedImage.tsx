'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fill = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // For SVG files, use regular img tag as Next Image doesn't optimize SVGs
  if (src.endsWith('.svg')) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  if (hasError) {
    return (
      <div 
        className={`bg-gray-800 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-500 text-xs">Failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={!fill ? { width, height } : {}}>
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoadingComplete={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width || 100}
          height={height || 100}
          priority={priority}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoadingComplete={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse rounded" />
      )}
    </div>
  );
};

export default OptimizedImage;