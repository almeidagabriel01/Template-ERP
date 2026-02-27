import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../../init";
import {
  buildProposalPdfStoragePath,
  parseStoragePathFromUrl,
  isUrlAccessible,
  downloadPdfFromSafeUrl,
  toDate,
} from "./whatsapp.utils";
import { getProposalByIdForTenant } from "./whatsapp.db";
import { getOrGenerateProposalPdfBuffer } from "../proposal-pdf.service";

const PDF_GENERATION_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export async function getOrGenerateProposalPdf(
  tenantId: string,
  proposalId: string,
): Promise<{ pdfBuffer: Buffer; pdfPath: string }> {
  const proposal = await getProposalByIdForTenant(tenantId, proposalId);
  if (!proposal) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const bucket = getStorage().bucket();
  const standardPath = buildProposalPdfStoragePath(tenantId, proposal.id);
  const attachments = Array.isArray(proposal.attachments)
    ? proposal.attachments
    : [];
  const attachmentPdfUrl = attachments
    .map((attachment) => {
      const typedAttachment = attachment as {
        name?: unknown;
        type?: unknown;
        url?: unknown;
      };
      const name = String(typedAttachment.name || "").toLowerCase();
      const type = String(typedAttachment.type || "").toLowerCase();
      if (type === "pdf" || name.endsWith(".pdf")) {
        return String(typedAttachment.url || "").trim();
      }
      return "";
    })
    .find((url) => Boolean(url));
  const existingPdfUrl =
    typeof proposal.pdfUrl === "string" ? proposal.pdfUrl.trim() : "";
  const existingPdfPath =
    typeof proposal.pdfPath === "string" ? proposal.pdfPath.trim() : "";
  const preferredExistingUrl = existingPdfUrl || attachmentPdfUrl || "";
  const proposalRef = db.collection("proposals").doc(proposal.id);

  if (preferredExistingUrl && (await isUrlAccessible(preferredExistingUrl))) {
    const resolvedPath =
      existingPdfPath ||
      parseStoragePathFromUrl(preferredExistingUrl) ||
      standardPath;
    await proposalRef.update({
      pdfPath: resolvedPath,
      pdfUrl: preferredExistingUrl,
    });
    console.log("[WhatsApp] PDF found existing accessible URL", {
      proposalId: proposal.id,
      tenantId,
      pdfPath: resolvedPath,
    });

    // Instead of signed URL, we download from URL to a buffer if there's no path
    // Or download from storage if we have a path
    try {
      const file = bucket.file(resolvedPath);
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        return { pdfBuffer: buffer, pdfPath: resolvedPath };
      } else {
        const remotePdfBuffer =
          await downloadPdfFromSafeUrl(preferredExistingUrl);
        if (remotePdfBuffer) {
          return { pdfBuffer: remotePdfBuffer, pdfPath: resolvedPath };
        }
      }
    } catch (e) {
      console.error("Failed to download existing pdf", e);
    }
  }

  const pathCandidates = Array.from(
    new Set(
      [
        existingPdfPath,
        parseStoragePathFromUrl(existingPdfUrl),
        parseStoragePathFromUrl(attachmentPdfUrl || ""),
        standardPath,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  for (const pathCandidate of pathCandidates) {
    const file = bucket.file(pathCandidate);
    const [exists] = await file.exists();
    if (!exists) continue;

    const [buffer] = await file.download();

    await proposalRef.update({
      pdfPath: pathCandidate,
    });

    console.log("[WhatsApp] PDF found existing in bucket", {
      proposalId: proposal.id,
      tenantId,
      pdfPath: pathCandidate,
    });
    return { pdfBuffer: buffer, pdfPath: pathCandidate };
  }

  const lockOwner = `wa-${proposal.id}-${Date.now()}`;
  const lockAcquired = await db.runTransaction(async (transaction) => {
    const proposalSnap = await transaction.get(proposalRef);
    if (!proposalSnap.exists) {
      throw new Error("PROPOSAL_NOT_FOUND");
    }

    const data = proposalSnap.data() as
      | {
          pdfGenerationLock?: { lockedAt?: unknown; lockedBy?: unknown };
        }
      | undefined;
    const lock = data?.pdfGenerationLock;
    const lockDate = toDate(lock?.lockedAt);
    const lockIsStale =
      !lockDate ||
      Date.now() - lockDate.getTime() > PDF_GENERATION_LOCK_TIMEOUT_MS;
    const isLockedByOther =
      !!lock &&
      !lockIsStale &&
      String(lock.lockedBy || "").trim() &&
      String(lock.lockedBy || "").trim() !== lockOwner;

    if (isLockedByOther) {
      return false;
    }

    transaction.update(proposalRef, {
      pdfGenerationLock: {
        lockedAt: FieldValue.serverTimestamp(),
        lockedBy: lockOwner,
      },
    });
    return true;
  });

  if (!lockAcquired) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const refreshed = await proposalRef.get();
      const refreshedData = refreshed.data() as
        | { pdfPath?: unknown; pdfUrl?: unknown }
        | undefined;
      const refreshedPath = String(refreshedData?.pdfPath || "").trim();

      if (refreshedPath) {
        const waitingFile = bucket.file(refreshedPath);
        const [exists] = await waitingFile.exists();
        if (exists) {
          const [buffer] = await waitingFile.download();
          console.log("[WhatsApp] PDF found existing (delayed lock)", {
            proposalId: proposal.id,
            tenantId,
            pdfPath: refreshedPath,
          });
          return { pdfBuffer: buffer, pdfPath: refreshedPath };
        }
      }
    }

    throw new Error("PDF_GENERATION_IN_PROGRESS");
  }

  const pdfPath = standardPath;
  const file = bucket.file(pdfPath);

  try {
    const generatedPdfBuffer = await getOrGenerateProposalPdfBuffer(
      tenantId,
      proposalId,
    );

    await file.save(generatedPdfBuffer, {
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, max-age=3600",
      },
    });

    await proposalRef.update({
      pdfPath,
      pdfGeneratedAt: FieldValue.serverTimestamp(),
      pdfGenerationLock: FieldValue.delete(),
    });

    console.log("[WhatsApp] PDF generated", {
      proposalId: proposal.id,
      tenantId,
      pdfPath,
    });

    return { pdfBuffer: generatedPdfBuffer, pdfPath };
  } catch (error) {
    await proposalRef.update({
      pdfGenerationLock: FieldValue.delete(),
    });
    throw error;
  }
}
