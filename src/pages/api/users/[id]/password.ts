import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import bcrypt from "bcrypt";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { id } = req.query as { id: string };

  try {
    await connectDB();
    const { currentPassword, newPassword } = req.body as any;
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: 'Incorrect current password' });
    await storage.updateUser(user.id, { password: newPassword } as any);
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'Failed to update password' });
  }
}
