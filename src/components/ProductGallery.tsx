import { useEffect, useState } from 'react'
import { Product } from '../types'
import { getOptimizedImageSource } from '../utils/imageSource'

interface ProductGalleryProps {
  product: Product
  className?: string
  imageClassName?: string
}

function getRepresentativePhoto(product: Product) {
  const identity = `${product.species} ${product.name} ${product.preparation}`.toLowerCase()
  if (/\b(omena|dagaa)\b/.test(identity)) return '/images/products/omena-dried-wikimedia.jpg'
  if (/\b(catfish|nduma|mumi)\b/.test(identity)) return '/images/products/catfish-wikimedia.jpg'
  if (/\b(nile perch|mbuta)\b/.test(identity)) return '/images/products/nile-perch-wikimedia.jpg'
  if (product.category === 'fillet') return '/images/products/pexels-fillet.jpg'
  if (product.category === 'smoked') return '/images/products/pexels-smoked.jpg'
  if (product.category === 'ready-to-eat') {
    return /grill|choma/i.test(identity) ? '/images/products/pexels-grilled.jpg' : '/images/products/pexels-fried.jpg'
  }
  if (product.category === 'coastal-seafood') return '/images/products/pexels-15553656.jpg'
  if (product.category === 'small-fish') return '/images/products/fresh-pexels-b.jpg'
  if (/\btilapia\b/.test(identity)) return '/images/products/pexels-tilapia.jpg'
  return '/images/products/fresh-pexels-a.jpg'
}

export default function ProductGallery({ product, className = '', imageClassName = '' }: ProductGalleryProps) {
  const productPhotos = [...new Set([product.image, ...product.photos].filter(Boolean))]
  const photos = [...new Set([...productPhotos, getRepresentativePhoto(product)])]
  const [photoIndex, setPhotoIndex] = useState(0)
  const [unavailable, setUnavailable] = useState(false)
  const currentIndex = photoIndex < photos.length ? photoIndex : 0
  const photo = photos[currentIndex]
  const isRepresentativePhoto = currentIndex >= productPhotos.length

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
        <>
          <img
            className={`product-gallery-image ${imageClassName}`.trim()}
            src={getOptimizedImageSource(photo)}
            alt={isRepresentativePhoto
              ? `Representative photo for ${product.name}; the actual product may differ`
              : `${product.species} ${product.preparation} ${product.name}`}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
        </>
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
      {productPhotos.length > 1 && !unavailable ? (
        <div className="product-gallery-controls" role="group" aria-label={`${product.name} photos`}>
          {productPhotos.map((_, index) => (
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
