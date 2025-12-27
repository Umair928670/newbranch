import type { NextApiRequest, NextApiResponse } from "next";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadStorage = new CloudinaryStorage({
  cloudinary: cloudinary as any,
  params: {
    folder: 'unipool',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
  } as any,
});

const upload = multer({ storage: uploadStorage as any });

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await connectDB();
    await runMiddleware(req, res, upload.single('avatar'));

    const anyReq: any = req;
    if (!anyReq.file) return res.status(400).json({ message: 'No file uploaded' });

    const avatarUrl = anyReq.file.path;
    const user = await storage.updateUser((req.query as any).id, { avatar: avatarUrl } as any);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { password: _pw, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (error: any) {
    console.error('Avatar Upload Error:', error);
    res.status(500).json({ message: error?.message || 'Upload failed' });
  }
}
