import { Router } from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import streamifier from 'streamifier';

const router = Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadToCloudinary = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      { folder: 'brajmart', resource_type: 'image' },
      (error: any, result: any) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

router.post('/', upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const url = await uploadToCloudinary(file.buffer);
    res.json({ url });
  } catch (err: any) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ message: err?.message || 'Upload failed' });
  }
});

export default router;
