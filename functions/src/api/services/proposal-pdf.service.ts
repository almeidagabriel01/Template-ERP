import { createHash } from "node:crypto";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { chromium } from "playwright-core";
import chromiumPackage from "@sparticuz/chromium";
import { db } from "../../init";
import {
  renderProposalPdfHtml,
  type ProposalPdfTemplatePayload,
} from "../../shared/pdf/ProposalPdfTemplate";

const PDF_TEMPLATE_VERSION = "proposal-pdf-v2-server-html";
const PDF_VIEWPORT_WIDTH = 1280;
const PDF_VIEWPORT_HEIGHT = 1700;
const PDF_PAGE_READY_TIMEOUT_MS = 45_000;
const PDF_RENDER_ASSET_TIMEOUT_MS = 20_000;

type ProposalPdfMetadata = {
  storagePath?: string;
  versionHash?: string;
};

type ProductLike = {
  productId?: unknown;
  itemType?: unknown;
  productImage?: unknown;
  productImages?: unknown;
  productDescription?: unknown;
  quantity?: unknown;
  status?: unknown;
  _isGhost?: unknown;
  _shouldHide?: unknown;
  _isInactive?: unknown;
  [key: string]: unknown;
};

type ProposalDocData = {
  tenantId?: unknown;
  pdf?: ProposalPdfMetadata;
  createdAt?: unknown;
  updatedAt?: unknown;
  products?: ProductLike[];
  [key: string]: unknown;
};

type TenantDocData = {
  name?: unknown;
  primaryColor?: unknown;
  logoUrl?: unknown;
  proposalDefaults?: unknown;
  [key: string]: unknown;
};

function getProposalPdfStoragePath(tenantId: string, proposalId: string): string {
  return `tenants/${tenantId}/proposals/${proposalId}/pdf/proposal.pdf`;
}

function toSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }
  if (typeof value === "object") {
    if (
      "toDate" in (value as Record<string, unknown>) &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      try {
        return ((value as { toDate: () => Date }).toDate()).toISOString();
      } catch {
        return null;
      }
    }

    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, raw]) => typeof raw !== "undefined" && typeof raw !== "function")
      .sort(([a], [b]) => a.localeCompare(b));

    const normalized: Record<string, unknown> = {};
    sortedEntries.forEach(([key, raw]) => {
      normalized[key] = toSerializable(raw);
    });
    return normalized;
  }
  return value;
}

function stableHash(payload: unknown): string {
  const serialized = JSON.stringify(toSerializable(payload));
  return createHash("sha256").update(serialized).digest("hex");
}

function buildVersionHash(
  proposalId: string,
  proposalData: ProposalDocData,
  tenantData: TenantDocData,
): string {
  const {
    pdf: _pdfMetadata,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...proposalRelevant
  } = proposalData;

  return stableHash({
    templateVersion: PDF_TEMPLATE_VERSION,
    proposalId,
    proposal: proposalRelevant,
    tenant: {
      name: tenantData.name || "",
      primaryColor: tenantData.primaryColor || "",
      logoUrl: tenantData.logoUrl || "",
      proposalDefaults: tenantData.proposalDefaults || null,
    },
  });
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toNumberValue(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function extractImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (
        item &&
        typeof item === "object" &&
        "url" in (item as Record<string, unknown>) &&
        typeof (item as Record<string, unknown>).url === "string"
      ) {
        return String((item as Record<string, unknown>).url).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeProposalProduct(product: ProductLike): ProductLike {
  const quantity = Math.max(0, toNumberValue(product.quantity));
  const normalizedImages = extractImageUrls(product.productImages);
  const fallbackImage = toStringValue(product.productImage) || normalizedImages[0] || "";
  const isGhost = quantity <= 0;

  return {
    ...product,
    quantity,
    productImage: fallbackImage,
    productImages:
      normalizedImages.length > 0
        ? normalizedImages
        : fallbackImage
          ? [fallbackImage]
          : [],
    _isGhost: isGhost,
    _shouldHide: Boolean(product._shouldHide || isGhost),
  };
}

async function enrichProposalProducts(
  proposalData: ProposalDocData,
  tenantId: string,
): Promise<ProposalDocData> {
  const sourceProducts = Array.isArray(proposalData.products)
    ? proposalData.products
    : [];

  const normalizedProducts = sourceProducts.map((product) =>
    normalizeProposalProduct(product),
  );

  const visibleProducts = normalizedProducts.filter(
    (product) => toNumberValue(product.quantity) > 0,
  );

  const productIds = Array.from(
    new Set(
      visibleProducts
        .map((product) => toStringValue(product.productId))
        .filter(Boolean),
    ),
  );

  if (!tenantId || productIds.length === 0) {
    return {
      ...proposalData,
      products: visibleProducts,
    };
  }

  const productCatalogMap = new Map<string, Record<string, unknown>>();
  const chunks = chunkArray(productIds, 10);

  await Promise.all(
    chunks.map(async (idsChunk) => {
      const catalogSnap = await db
        .collection("products")
        .where("tenantId", "==", tenantId)
        .where(FieldPath.documentId(), "in", idsChunk)
        .get();

      catalogSnap.docs.forEach((docSnap) => {
        productCatalogMap.set(
          docSnap.id,
          docSnap.data() as Record<string, unknown>,
        );
      });
    }),
  );

  const enrichedProducts = visibleProducts.map((product) => {
    const productId = toStringValue(product.productId);
    const catalogProduct = productId ? productCatalogMap.get(productId) : undefined;

    if (!catalogProduct) {
      const isInactive = toStringValue(product.status) === "inactive";
      return {
        ...product,
        _isInactive: isInactive,
        _shouldHide: Boolean(product._shouldHide || product._isGhost || isInactive),
      };
    }

    const catalogImages = extractImageUrls(catalogProduct.images);
    const catalogImage =
      typeof catalogProduct.image === "string" ? catalogProduct.image : "";

    const mergedImages =
      catalogImages.length > 0
        ? catalogImages
        : catalogImage
          ? [catalogImage]
          : extractImageUrls(product.productImages);
    const mergedImage = mergedImages[0] || toStringValue(product.productImage);

    const status = toStringValue(catalogProduct.status) || toStringValue(product.status);
    const isInactive = status === "inactive";

    return {
      ...product,
      productImage: mergedImage,
      productImages: mergedImages,
      productDescription:
        toStringValue(catalogProduct.description) ||
        toStringValue(product.productDescription),
      _isInactive: isInactive,
      _shouldHide: Boolean(product._shouldHide || product._isGhost || isInactive),
    };
  });

  return {
    ...proposalData,
    products: enrichedProducts,
  };
}

async function generatePdfFromHtml(html: string): Promise<Buffer> {
  chromiumPackage.setGraphicsMode = false;
  const executablePath = await chromiumPackage.executablePath();
  const pageErrors: string[] = [];

  const browser = await chromium.launch({
    executablePath,
    args: chromiumPackage.args,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: PDF_VIEWPORT_WIDTH, height: PDF_VIEWPORT_HEIGHT },
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failureText}`);
    });

    await page.route("**/*", async (route, request) => {
      try {
        const hostname = new URL(request.url()).hostname.toLowerCase();
        if (
          hostname === "vercel.com" ||
          hostname.endsWith(".vercel.com") ||
          hostname.endsWith(".vercel.app")
        ) {
          await route.abort("blockedbyclient");
          return;
        }
      } catch {
        // Ignore URL parse failures and continue request.
      }

      await route.continue();
    });

    await page.setContent(html, {
      waitUntil: "load",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.waitForFunction(
      async () => {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore fonts readiness failures.
        }

        const imageWaiters = Array.from(document.images).map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        );

        await Promise.all(imageWaiters);
        return true;
      },
      { timeout: PDF_RENDER_ASSET_TIMEOUT_MS },
    );

    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = pageErrors.slice(0, 8).join(" || ") || "UNAVAILABLE";
    throw new Error(`PDF_RENDER_FAILED: ${message} | pageErrors=${diagnostics}`);
  } finally {
    await browser.close();
  }
}

export async function getOrGenerateProposalPdfBuffer(
  tenantId: string,
  proposalId: string,
): Promise<Buffer> {
  const proposalRef = db.collection("proposals").doc(proposalId);
  const proposalSnap = await proposalRef.get();
  if (!proposalSnap.exists) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const proposalData = (proposalSnap.data() || {}) as ProposalDocData;
  const proposalTenantId = toStringValue(proposalData.tenantId);
  if (!proposalTenantId || proposalTenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = (tenantSnap.data() || {}) as TenantDocData;

  const storagePath = getProposalPdfStoragePath(tenantId, proposalId);
  const versionHash = buildVersionHash(proposalId, proposalData, tenantData);
  const currentPdfMetadata = proposalData.pdf || {};

  const isCacheMetadataValid =
    typeof currentPdfMetadata.storagePath === "string" &&
    typeof currentPdfMetadata.versionHash === "string" &&
    currentPdfMetadata.storagePath === storagePath &&
    currentPdfMetadata.versionHash === versionHash;

  const bucket = getStorage().bucket();
  const storageFile = bucket.file(storagePath);

  if (isCacheMetadataValid) {
    const [exists] = await storageFile.exists();
    if (exists) {
      const [cachedBuffer] = await storageFile.download();
      return cachedBuffer;
    }
  }

  const enrichedProposalData = await enrichProposalProducts(proposalData, tenantId);

  const templatePayload: ProposalPdfTemplatePayload = {
    proposalId,
    proposal: toSerializable({
      id: proposalId,
      ...enrichedProposalData,
    }) as ProposalPdfTemplatePayload["proposal"],
    tenant: {
      id: tenantId,
      name: toStringValue(tenantData.name),
      logoUrl: toStringValue(tenantData.logoUrl),
      primaryColor: toStringValue(tenantData.primaryColor),
      proposalDefaults: toSerializable(tenantData.proposalDefaults),
    },
  };

  const html = renderProposalPdfHtml(templatePayload);
  const generatedBuffer = await generatePdfFromHtml(html);

  await storageFile.save(generatedBuffer, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=3600",
      metadata: {
        tenantId,
        proposalId,
        versionHash,
      },
    },
  });

  await proposalRef.set(
    {
      pdf: {
        storagePath,
        versionHash,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  return generatedBuffer;
}
