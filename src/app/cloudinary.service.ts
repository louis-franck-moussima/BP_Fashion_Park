import { Injectable, inject } from '@angular/core';
import { environment } from '../environments/environment';
import { ProductImage } from './product.model';
import { FirebaseAppService } from './firebase-app.service';

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  error?: { message: string };
}

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ]);
  private readonly maximumFileSize = 8 * 1024 * 1024;
  private readonly maximumFiles = 8;
  readonly configured = Boolean(
    environment.cloudinary.cloudName && environment.cloudinary.uploadPreset,
  );

  async uploadMany(
    files: File[],
    productName: string,
  ): Promise<ProductImage[]> {
    if (files.length > this.maximumFiles)
      throw new Error(
        `Add no more than ${this.maximumFiles} images per product.`,
      );
    for (const file of files) {
      if (!this.allowedTypes.has(file.type))
        throw new Error(`${file.name} is not a supported image format.`);
      if (file.size > this.maximumFileSize)
        throw new Error(`${file.name} is larger than 8 MB.`);
    }
    if (!this.configured) return this.localPreviews(files, productName);
    return Promise.all(
      files.map((file, index) =>
        this.upload(
          file,
          `${productName} ${index + 1}`,
          'bp-fashion-park/products',
        ),
      ),
    );
  }

  async uploadCategory(
    file: File,
    categoryName: string,
  ): Promise<ProductImage> {
    if (!this.allowedTypes.has(file.type))
      throw new Error(`${file.name} is not a supported image format.`);
    if (file.size > this.maximumFileSize)
      throw new Error(`${file.name} is larger than 8 MB.`);
    if (!this.configured) return this.localPreviews([file], categoryName)[0];
    return this.upload(
      file,
      `${categoryName} category cover`,
      'bp-fashion-park/categories',
    );
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!publicId) return;
    if (!this.firebase.app)
      throw new Error('Firebase is not connected for secure image deletion.');
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const callable = httpsCallable<{ publicId: string }, { deleted: boolean }>(
      getFunctions(this.firebase.app, 'europe-west1'),
      'deleteCloudinaryImage',
    );
    await callable({ publicId });
  }

  async deleteImages(images: ProductImage[]): Promise<void> {
    const publicIds = [
      ...new Set(
        images
          .map((image) => image.publicId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const results = await Promise.allSettled(
      publicIds.map((id) => this.deleteImage(id)),
    );
    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length;
    if (failed)
      throw new Error(
        `${failed} Cloudinary image${failed === 1 ? '' : 's'} could not be deleted.`,
      );
  }

  private async upload(
    file: File,
    alt: string,
    folder: string,
  ): Promise<ProductImage> {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', environment.cloudinary.uploadPreset);
    body.append('folder', folder);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body },
    );
    const result = (await response.json()) as CloudinaryResponse;
    if (!response.ok || result.error)
      throw new Error(result.error?.message ?? 'Image upload failed');
    return { url: result.secure_url, publicId: result.public_id, alt };
  }

  private localPreviews(files: File[], productName: string): ProductImage[] {
    return files.map((file, index) => ({
      url: URL.createObjectURL(file),
      alt: `${productName || 'Product'} ${index + 1}`,
    }));
  }
}
