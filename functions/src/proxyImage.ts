import * as functions from "firebase-functions";

interface ProxyImageRequest {
  url: string;
}

export const proxyImage = functions
  .region("southamerica-east1")
  .https.onCall(async (request) => {
    // Support both direct data access and wrapped data access
    const data = (request.data || request) as ProxyImageRequest;
    const { url } = data;

    if (!url) {
      throw new functions.https.HttpsError("invalid-argument", "Missing URL");
    }

    try {
      // Validate that the URL is from an allowed domain (optional but good practice)
      // For now, we allow any URL, or we could restrict to firebasestorage.googleapis.com

      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
        throw new functions.https.HttpsError(
          "internal",
          `Failed to fetch image: ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = response.headers.get("content-type") || "image/png";

      return {
        success: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
      };
    } catch (error: any) {
      console.error("Proxy image error:", error);
      // Return a failed response mostly to avoid crushing the client logic completely
      // or just throw
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Unknown error proxying image"
      );
    }
  });
