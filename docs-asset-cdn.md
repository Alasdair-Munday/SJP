# Cloudflare-backed image assets

Editor-managed photo assets keep their existing public paths, such as `/images/uploads/example.jpg` and `/images/profile-photos/person.jpg`. Netlify rewrites those paths to a Cloudflare R2-backed origin when the files are no longer present in the repository, so existing content values do not need to change and Netlify Image CDN requests like `/.netlify/images?url=/images/uploads/example.jpg&w=960` can continue to optimize the same paths.

## Required environment variables

Set these in Netlify before enabling the CDN-backed media library or running the migration script without `--dry-run`:

- `ASSET_CDN_BASE_URL`: public Cloudflare-backed base URL that serves object keys such as `images/uploads/example.jpg`.
- `CLOUDFLARE_R2_ACCOUNT_ID`: Cloudflare account ID for the R2 account.
- `CLOUDFLARE_R2_BUCKET`: R2 bucket name.
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 S3 API access key.
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 S3 API secret key.

## Migration workflow

1. Preview the migration:

   ```sh
   npm run migrate:assets -- --dry-run
   ```

2. Upload assets to Cloudflare R2 and write `asset-migration-manifest.json`:

   ```sh
   npm run migrate:assets
   ```

3. Verify a few existing paths through the deployed Netlify site, for example `/images/uploads/Prayer.png` and a Netlify Image CDN URL that references it.

4. Once the CDN copy is verified, remove local migrated files in a follow-up cleanup run:

   ```sh
   npm run migrate:assets -- --delete-local
   ```

The manifest maps each existing site path to its Cloudflare object key and CDN URL. Content is intentionally not rewritten because the site continues to use the existing paths.


## Image delivery

The photo component already requests responsive sizes through Netlify Image CDN. It negotiates WebP or AVIF automatically; no explicit format or changes to the source files are needed. The hero title artwork, card icons and decorative image masks also use source-only Image CDN requests, which retain their original dimensions and negotiate an appropriate format. SVGs, GIFs, external URLs and local Astro development use their original paths. CSS-defined shapes and images embedded in rich text are not covered by this change.

Validate a Netlify Deploy Preview with a browser that accepts WebP: check the content type of artwork and managed photos, including transparent masks, and compare Lighthouse against production. Test local Astro development separately. Netlify Image CDN is not emulated by plain Astro preview; use Netlify Dev or a Deploy Preview for CDN verification.
