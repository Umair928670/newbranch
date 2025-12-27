import type { NextApiRequest, NextApiResponse } from "next";
import Ably from 'ably';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const clientId = (req.query.userId as string) || 'anonymous';
    const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
    const tokenRequest = await ably.auth.createTokenRequest({ clientId });
    res.json(tokenRequest);
  } catch (err: any) {
    console.error('Ably Auth Error:', err);
    res.status(500).send('Error generating Ably token');
  }
}
