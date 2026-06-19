import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /** Uploads a file buffer to Cloudinary and returns the public, directly-renderable secure URL. */
  uploadFile(buffer: Buffer, mimeType: string): Promise<{ url: string; publicId: string }> {
    const resourceType = mimeType.startsWith('video/') ? 'video' : 'image';

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder: 'rizz-products' },
        (error, result?: UploadApiResponse) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed.'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }
}
