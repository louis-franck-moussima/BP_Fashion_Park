import { v2 as cloudinary } from 'cloudinary';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const cloudName = defineSecret('CLOUDINARY_CLOUD_NAME');
const apiKey = defineSecret('CLOUDINARY_API_KEY');
const apiSecret = defineSecret('CLOUDINARY_API_SECRET');

export const deleteCloudinaryImage = onCall(
  {
    region: 'europe-west1',
    secrets: [cloudName, apiKey, apiSecret],
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError(
        'unauthenticated',
        'Administrator sign-in is required.',
      );
    const publicId =
      typeof request.data?.publicId === 'string'
        ? request.data.publicId.trim()
        : '';
    if (
      !publicId.startsWith('bp-fashion-park/products/') ||
      publicId.length > 300
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Invalid product image identifier.',
      );
    }
    cloudinary.config({
      cloud_name: cloudName.value(),
      api_key: apiKey.value(),
      api_secret: apiSecret.value(),
      secure: true,
    });
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
    if (!['ok', 'not found'].includes(result.result))
      throw new HttpsError(
        'internal',
        'Cloudinary could not delete this image.',
      );
    return { deleted: true, result: result.result };
  },
);
