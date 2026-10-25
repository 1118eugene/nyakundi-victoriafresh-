const localRasterImage = /^\/images\/(.+)\.(?:jpe?g|png)$/i

export function getOptimizedImageSource(source: string) {
  const match = localRasterImage.exec(source)
  if (!match) return source
  return `/images/optimized/${match[1]}.webp`
}
