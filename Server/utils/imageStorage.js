import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
const productUploadsDir = path.join(uploadsRoot, 'products');

const contentTypeToExtension = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const slugify = (value) =>
  String(value || 'image')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const resolveExtension = (url, contentType) => {
  const pathnameExtension = path.extname(new URL(url).pathname);
  if (pathnameExtension) return pathnameExtension;
  return contentTypeToExtension[contentType] || '.jpg';
};

export const ensureProductUploadsDir = async () => {
  await fs.mkdir(productUploadsDir, { recursive: true });
  return productUploadsDir;
};

export const isLocalImagePath = (imagePath) => typeof imagePath === 'string' && imagePath.startsWith('/uploads/');

export const persistRemoteImage = async ({ imageUrl, productName }) => {
  if (!imageUrl || isLocalImagePath(imageUrl)) {
    return {
      image: imageUrl,
      imageOriginalUrl: imageUrl,
    };
  }

  await ensureProductUploadsDir();

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${imageUrl}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const extension = resolveExtension(imageUrl, contentType);
  const fileName = `${slugify(productName)}-${Date.now()}${extension}`;
  const targetPath = path.join(productUploadsDir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(targetPath, buffer);

  return {
    image: `/uploads/products/${fileName}`,
    imageOriginalUrl: imageUrl,
  };
};
