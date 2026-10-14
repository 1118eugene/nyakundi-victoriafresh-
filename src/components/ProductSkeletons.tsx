interface ProductSkeletonsProps {
  count?: number
}

export default function ProductSkeletons({ count = 4 }: ProductSkeletonsProps) {
  return (
    <div className="grid grid-4 catalogue-skeletons" role="status" aria-label="Loading current catalogue" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card product-skeleton" aria-hidden="true" key={index}>
          <div className="product-skeleton-image" />
          <div className="product-content">
            <span className="product-skeleton-line product-skeleton-title" />
            <span className="product-skeleton-line" />
            <span className="product-skeleton-line product-skeleton-price" />
          </div>
        </div>
      ))}
    </div>
  )
}
