const managedAssetPrefixes = ["/images/uploads/", "/images/profile-photos/"] as const;

export const isManagedAssetPath = (src: string) =>
  managedAssetPrefixes.some((prefix) => src.startsWith(prefix));

export const isLocalRasterImage = (src: string) =>
  src.startsWith("/") && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(src);

export const getNetlifyOptimizedImageUrl = ({
  src,
  width,
  height,
  quality,
}: {
  src: string;
  width: number;
  height: number;
  quality: number;
}) => `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&h=${height}&q=${quality}`;
