import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API handler to generate color palettes via Gemini
  app.post("/api/generate-palette", async (req, res) => {
    const { baseColor } = req.body;
    if (!baseColor) {
      return res.status(400).json({ error: "baseColor is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Graceful local fallback if Developer API Key is not set yet
      return res.json({
        success: true,
        palette: {
          paletteName: `Harmony of ${baseColor.toUpperCase()}`,
          colors: [
            baseColor,
            adjustBrightness(baseColor, 20),
            adjustBrightness(baseColor, -20),
            invertColor(baseColor)
          ],
          relationshipType: "Aesthetic Analogous & Complementary (Local Mock Fallback)"
        }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Generate a beautiful color palette of 3 to 4 hex colors related to ${baseColor} (e.g., complementary, analogous, monochromatic, software modern UI style). Describe the theme and color relationship.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["paletteName", "colors", "relationshipType"],
            properties: {
              paletteName: {
                type: Type.STRING,
                description: "A descriptive creative name for the generated palette"
              },
              colors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 to 4 hex color strings including the '#' prefix"
              },
              relationshipType: {
                type: Type.STRING,
                description: "The visual harmony relationship (e.g., Analogous, Complementary, Triadic, Soft Monochromatic)"
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI models");
      }
      
      const data = JSON.parse(text.trim());
      res.json({ success: true, palette: data });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate palette" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Simple color utilities for mock fallback
function adjustBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace("#",""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

function invertColor(hex: string): string {
  let num = parseInt(hex.replace("#",""), 16),
      R = 255 - (num >> 16),
      G = 255 - (num >> 8 & 0x00FF),
      B = 255 - (num & 0x0000FF);
  return "#" + (0x1000000 + R*0x10000 + G*0x100 + B).toString(16).slice(1);
}

startServer();
