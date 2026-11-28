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


// Keep local development, external URLs, vector files and animation unchanged.
export const getDisplayImageUrl = (src: string, width = 1024) =>
  import.meta.env.DEV || !isLocalRasterImage(src) || /\.gif$/i.test(src)
    ? src
    : `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=80`;

export const getDisplayImageSrcset = (src: string) =>
  import.meta.env.DEV || !isLocalRasterImage(src) || /\.gif$/i.test(src)
    ? undefined
    : [320, 480, 640, 768, 960, 1200]
        .map((width) => `${getDisplayImageUrl(src, width)} ${width}w`)
        .join(", ");
