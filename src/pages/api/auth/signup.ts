import type { NextApiRequest, NextApiResponse } from "next";
import { connectDB } from "@/db";
import { storage } from "@/storage";
import { signupSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    await connectDB();

    const result = signupSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: fromZodError(result.error).message });

    const { email, password, name, role, phone } = result.data;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const user = await storage.createUser({
      email,
      password,
      name,
      role: role || "passenger",
      phone: phone || null,
      clerkId: null,
      avatar: null,
      cnic: null,
      cnicStatus: "not_uploaded",
      isAdmin: false,
    } as any);

    const { password: _pw, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (error: any) {
    res.status(500).json({ message: error?.message || "Signup failed" });
  }
}
