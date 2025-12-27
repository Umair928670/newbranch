import type { NextApiRequest, NextApiResponse } from "next";
import Ably from 'ably';
import fs from 'fs';
import path from 'path';

const ABLY_LOG_PATH = path.join(process.cwd(), 'ably-publishes.log');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY || 'Missing_Key');
    const bookingChannel = ably.channels.get('booking:test-pub');
    try { fs.appendFileSync(ABLY_LOG_PATH, `test: publishing booking.created -> booking:test-pub\n`); } catch {};
    await bookingChannel.publish('booking.created', { test: true });
    try { fs.appendFileSync(ABLY_LOG_PATH, `test: published booking.created -> booking:test-pub\n`); } catch {};

    const driverChannel = ably.channels.get('driver:test-driver');
    try { fs.appendFileSync(ABLY_LOG_PATH, `test: publishing booking.created -> driver:test-driver\n`); } catch {};
    await driverChannel.publish('booking.created', { test: true });
    try { fs.appendFileSync(ABLY_LOG_PATH, `test: published booking.created -> driver:test-driver\n`); } catch {};

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Test publish failed', err);
    return res.status(500).json({ message: err?.message || 'publish failed' });
  }
}
