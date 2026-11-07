import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { ProductImage } from './product.model';

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  error?: { message: string };
}

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
  private readonly maximumFileSize = 8 * 1024 * 1024;
  private readonly maximumFiles = 8;
  readonly configured = Boolean(environment.cloudinary.cloudName && environment.cloudinary.uploadPreset);

  async uploadMany(files: File[], productName: string): Promise<ProductImage[]> {
    if (files.length > this.maximumFiles) throw new Error(`Add no more than ${this.maximumFiles} images per product.`);
    for (const file of files) {
      if (!this.allowedTypes.has(file.type)) throw new Error(`${file.name} is not a supported image format.`);
      if (file.size > this.maximumFileSize) throw new Error(`${file.name} is larger than 8 MB.`);
    }
    if (!this.configured) return this.localPreviews(files, productName);
    return Promise.all(files.map((file, index) => this.upload(file, `${productName} ${index + 1}`)));
  }

  private async upload(file: File, alt: string): Promise<ProductImage> {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', environment.cloudinary.uploadPreset);
    body.append('folder', 'bp-fashion-park/products');
    const response = await fetch(`https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`, { method: 'POST', body });
    const result = await response.json() as CloudinaryResponse;
    if (!response.ok || result.error) throw new Error(result.error?.message ?? 'Image upload failed');
    return { url: result.secure_url, publicId: result.public_id, alt };
  }

  private localPreviews(files: File[], productName: string): ProductImage[] {
    return files.map((file, index) => ({ url: URL.createObjectURL(file), alt: `${productName || 'Product'} ${index + 1}` }));
  }
}
