import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import { loginSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcrypt";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    await connectDB();

    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: fromZodError(result.error).message });
    }

    const { email, password } = result.data;
    const user = await storage.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid credentials" });

    const { password: _pw, ...safeUser } = user as any;
    return res.json(safeUser);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Login failed" });
  }
}
