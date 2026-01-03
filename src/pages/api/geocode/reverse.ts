import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const lat = req.query.lat as string;
  const lng = (req.query.lng as string) || (req.query.lon as string);

  if (!lat || !lng) {
    return res.status(400).json({ message: "lat and lng are required" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=en`;
    const response = await fetch(url, {
      headers: {
        // A descriptive user agent improves reliability with Nominatim
        "User-Agent": "unipool-app/1.0 (support@unipool.local)",
        "Accept": "application/json",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: text || "Reverse geocoding failed" });
    }

    const data = await response.json();
    const displayName = data?.display_name || null;
    const address = data?.address || null;
    return res.json({ displayName, address, lat: Number(lat), lng: Number(lng) });
  } catch (error: any) {
    console.error("Reverse geocode error:", error);
    return res.status(500).json({ message: error?.message || "Reverse geocoding error" });
  }
}
