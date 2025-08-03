'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/utils/responsive';

interface ResponsiveImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  mobileSrc?: string; // Optional smaller image for mobile
  alt: string;
  aspectRatio?: 'square' | '16/9' | '4/3' | '3/2' | 'auto';
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  eager?: boolean; // Load immediately instead of lazy loading
  fallback?: React.ReactNode; // Shown while loading
  onLoadComplete?: () => void;
}

export function ResponsiveImage({
  src,
  mobileSrc,
  alt,
  aspectRatio = 'auto',
  objectFit = 'cover',
  eager = false,
  fallback,
  onLoadComplete,
  className,
  ...props
}: ResponsiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { isMobile } = useBreakpoint();

  // Use mobile source if provided and on mobile device
  const imageSrc = isMobile && mobileSrc ? mobileSrc : src;

  const aspectRatioClasses = {
    square: 'aspect-square',
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
    auto: '',
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoadComplete?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={cn(
          'relative overflow-hidden bg-muted flex items-center justify-center',
          aspectRatioClasses[aspectRatio],
          className
        )}
      >
        <div className="text-center p-4">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">Failed to load image</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        aspectRatioClasses[aspectRatio],
        className
      )}
    >
      {/* Loading state */}
      {isLoading && fallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          {fallback}
        </div>
      )}

      {/* Image */}
      <Image
        src={imageSrc}
        alt={alt}
        fill={aspectRatio !== 'auto'}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          objectFit === 'contain' && 'object-contain',
          objectFit === 'cover' && 'object-cover',
          objectFit === 'fill' && 'object-fill',
          objectFit === 'none' && 'object-none',
          objectFit === 'scale-down' && 'object-scale-down'
        )}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={handleLoad}
        onError={handleError}
        sizes={
          props.sizes ||
          '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
        }
        {...props}
      />
    </div>
  );
}

// Responsive background image component
interface ResponsiveBackgroundProps {
  src: string;
  mobileSrc?: string;
  className?: string;
  children?: React.ReactNode;
  overlay?: boolean;
  overlayOpacity?: number;
}

export function ResponsiveBackground({
  src,
  mobileSrc,
  className,
  children,
  overlay = false,
  overlayOpacity = 0.5,
}: ResponsiveBackgroundProps) {
  const { isMobile } = useBreakpoint();
  const imageSrc = isMobile && mobileSrc ? mobileSrc : src;

  return (
    <div
      className={cn('relative', className)}
      style={{
        backgroundImage: `url(${imageSrc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

// Picture element wrapper for art direction
interface PictureSourceProps {
  media: string;
  srcSet: string;
  type?: string;
}

interface ResponsivePictureProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  sources: PictureSourceProps[];
  src: string; // Fallback source
  alt: string;
}

export function ResponsivePicture({
  sources,
  src,
  alt,
  className,
  ...props
}: ResponsivePictureProps) {
  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          media={source.media}
          srcSet={source.srcSet}
          type={source.type}
        />
      ))}
      <img
        src={src}
        alt={alt}
        className={cn('w-full h-auto', className)}
        loading="lazy"
        {...props}
      />
    </picture>
  );
}