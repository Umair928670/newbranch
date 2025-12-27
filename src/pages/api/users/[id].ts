import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  try {
    await connectDB();

    if (req.method === 'GET') {
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const { password: _pw, ...safeUser } = user as any;
      return res.json(safeUser);
    }

    if (req.method === 'PATCH') {
      const user = await storage.updateUser(id, req.body);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const { password: _pw, ...safeUser } = user as any;
      return res.json(safeUser);
    }

    if (req.method === 'DELETE') {
      const ok = await storage.deleteUser(id);
      if (!ok) return res.status(404).json({ message: 'User not found or already deleted' });
      return res.json({ success: true, message: 'Account permanently deleted' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error?.message || 'User request failed' });
  }
}
