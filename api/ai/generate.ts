// Vercel serverless function — protects ANTHROPIC_API_KEY server-side
// Deploy: Vercel auto-detects /api folder

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, boardState } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.length > 500) {
    return res.status(400).json({ error: "Invalid prompt (max 500 chars)" });
  }

  // TODO: Implement Anthropic Claude function calling
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // const message = await anthropic.messages.create({ ... })

  res.json({ message: "AI endpoint placeholder", prompt });
}
