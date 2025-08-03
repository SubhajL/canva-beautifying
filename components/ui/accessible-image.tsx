'use client';

import React from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface AccessibleImageProps extends Omit<ImageProps, 'alt'> {
  alt: string;
  decorative?: boolean; // For purely decorative images
  caption?: string;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
}

export function AccessibleImage({
  alt,
  decorative = false,
  caption,
  className,
  loading = 'lazy',
  onError,
  ...props
}: AccessibleImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const imageId = React.useId();

  const handleError = () => {
    setHasError(true);
    onError?.();
  };


  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        role="img"
        aria-label={decorative ? undefined : `Failed to load image: ${alt}`}
      >
        <svg
          className="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <figure className={caption ? 'space-y-2' : undefined}>
      <Image
        {...props}
        alt={decorative ? '' : alt}
        aria-hidden={decorative ? true : undefined}
        aria-describedby={!decorative && caption ? `${imageId}-caption` : undefined}
        className={className}
        loading={loading}
        onError={handleError}
      />
      {caption && (
        <figcaption
          id={`${imageId}-caption`}
          className="text-sm text-muted-foreground text-center"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// Icon component with proper ARIA handling
interface AccessibleIconProps {
  icon: React.ReactNode;
  label?: string; // If provided, icon is meaningful. If not, it's decorative.
  className?: string;
}

export function AccessibleIcon({ icon, label, className }: AccessibleIconProps) {
  if (label) {
    return (
      <span className={className} role="img" aria-label={label}>
        {icon}
      </span>
    );
  }

  // Decorative icon
  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
}

// Image gallery with proper ARIA
interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

interface AccessibleImageGalleryProps {
  images: GalleryImage[];
  label?: string;
  className?: string;
}

export function AccessibleImageGallery({
  images,
  label = 'Image gallery',
  className,
}: AccessibleImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const _galleryId = React.useId();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(images.length - 1);
        break;
    }
  };

  return (
    <div
      className={cn('space-y-4', className)}
      role="region"
      aria-label={label}
      aria-roledescription="image gallery"
    >
      {/* Main image display */}
      <div
        className="relative aspect-video"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Image ${selectedIndex + 1} of ${images.length}: ${images[selectedIndex].alt}`}
      >
        <AccessibleImage
          src={images[selectedIndex].src}
          alt={images[selectedIndex].alt}
          fill
          className="object-contain"
        />
      </div>

      {/* Thumbnail navigation */}
      <nav aria-label="Gallery thumbnails">
        <ul className="flex gap-2 overflow-x-auto" role="list">
          {images.map((image, index) => (
            <li key={index}>
              <button
                className={cn(
                  'relative w-20 h-20 overflow-hidden rounded-md border-2 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  index === selectedIndex
                    ? 'border-primary'
                    : 'border-transparent hover:border-muted-foreground'
                )}
                onClick={() => setSelectedIndex(index)}
                aria-label={`View image ${index + 1}: ${image.alt}`}
                aria-current={index === selectedIndex ? 'true' : undefined}
              >
                <AccessibleImage
                  src={image.src}
                  alt=""
                  decorative
                  fill
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Image information */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="text-center text-sm text-muted-foreground"
      >
        Image {selectedIndex + 1} of {images.length}
        {images[selectedIndex].caption && (
          <>: {images[selectedIndex].caption}</>
        )}
      </div>
    </div>
  );
}