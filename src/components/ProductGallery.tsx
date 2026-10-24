import { useEffect, useState } from 'react'
import { Product } from '../types'
import { getOptimizedImageSource } from '../utils/imageSource'

interface ProductGalleryProps {
  product: Product
  className?: string
  imageClassName?: string
}

export default function ProductGallery({ product, className = '', imageClassName = '' }: ProductGalleryProps) {
  const photos = [...new Set([product.image, ...product.photos].filter(Boolean))]
  const [photoIndex, setPhotoIndex] = useState(0)
  const [unavailable, setUnavailable] = useState(false)
  const currentIndex = photoIndex < photos.length ? photoIndex : 0
  const photo = photos[currentIndex]

  useEffect(() => {
    setPhotoIndex(0)
    setUnavailable(false)
  }, [product.id])

  function handleImageError() {
    if (currentIndex < photos.length - 1) {
      setPhotoIndex(currentIndex + 1)
    } else {
      setUnavailable(true)
    }
  }

  return (
    <div className={`product-gallery ${className}`.trim()}>
      {photo && !unavailable ? (
        <img
          className={`product-gallery-image ${imageClassName}`.trim()}
          src={getOptimizedImageSource(photo)}
          alt={`${product.species} ${product.preparation} ${product.name}`}
          loading="lazy"
          decoding="async"
          onError={handleImageError}
        />
      ) : (
        <div
          className={`product-gallery-placeholder ${imageClassName}`.trim()}
          role="img"
          aria-label={`No product photo is available for ${product.name}`}
        >
          <span>No product photo available</span>
          <strong>{product.species} · {product.preparation}</strong>
        </div>
      )}
      {photos.length > 1 && !unavailable ? (
        <div className="product-gallery-controls" role="group" aria-label={`${product.name} photos`}>
          {photos.map((_, index) => (
            <button
              key={`${product.id}-photo-${index}`}
              type="button"
              aria-label={`Show photo ${index + 1} of ${photos.length}`}
              aria-pressed={index === currentIndex}
              onClick={() => {
                setPhotoIndex(index)
                setUnavailable(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
