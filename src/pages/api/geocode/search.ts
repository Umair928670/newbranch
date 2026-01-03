import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string) || (req.body?.q as string);
  if (!q || q.trim().length < 3) {
    return res.status(400).json({ message: "q (query) is required" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "unipool-app/1.0 (support@unipool.local)",
        "Accept": "application/json",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: text || "Geocoding failed" });
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.json(null);
    }
    const first = data[0];
    return res.json({
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: String(first.display_name || q),
    });
  } catch (error: any) {
    console.error("Search geocode error:", error);
    return res.status(500).json({ message: error?.message || "Geocoding error" });
  }
}
