import { Request, Response } from "express";
import { getStorage } from "firebase-admin/storage";
import axios from "axios";

/**
 * Extracts the file path from a Firebase Storage URL
 */
function extractFirebaseStoragePath(url: string): string | null {
  try {
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.+?)\?/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the URL is a Firebase Storage URL
 */
function isFirebaseStorageUrl(url: string): boolean {
  return (
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("firebasestorage.app")
  );
}

export const proxyImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const imageUrl = req.query.url as string;

    if (!imageUrl) {
      return res.status(400).send("URL parameter is required.");
    }

    // If it's a Firebase Storage URL, use Admin SDK for direct access
    if (isFirebaseStorageUrl(imageUrl)) {
      const filePath = extractFirebaseStoragePath(imageUrl);

      if (filePath) {
        try {
          const bucket = getStorage().bucket();
          const file = bucket.file(filePath);

          // Check if file exists
          const [exists] = await file.exists();
          if (!exists) {
            console.error(`[Proxy] File not found: ${filePath}`);
            return res.status(404).send("Image not found.");
          }

          // Get file metadata for content type
          const [metadata] = await file.getMetadata();
          const contentType = metadata.contentType || "image/jpeg";

          // Download the file
          const [buffer] = await file.download();

          res.set("Content-Type", contentType);
          res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
          return res.send(buffer);
        } catch (storageError) {
          console.error(
            "[Proxy] Storage error, falling back to HTTP:",
            storageError
          );
          // Fall through to HTTP fallback
        }
      }
    }

    // Fallback: Use HTTP request for non-Firebase URLs or if Admin SDK fails
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const contentType = response.headers["content-type"];

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return res.send(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error proxying image.";
    console.error("Error proxying image:", message);
    return res.status(500).send("Error proxying image.");
  }
};
