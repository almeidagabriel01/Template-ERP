import { Request, Response } from "express";
import { getOrGenerateProposalPdfBuffer } from "../services/proposal-pdf.service";
import { db } from "../../init";

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "").trim();
}

function buildFilename(title?: string): string {
  const clean = sanitizeFilename(title || "");
  return clean ? `Proposta - ${clean}.pdf` : "Proposta.pdf";
}

export async function downloadProposalPdf(req: Request, res: Response) {
  try {
    const proposalId = String(req.params.id || "").trim();
    if (!proposalId) {
      return res.status(400).json({ message: "ID da proposta invalido" });
    }

    const authTenantId = String(req.user?.tenantId || "").trim();
    if (!authTenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch proposal title for filename
    const proposalSnap = await db.collection("proposals").doc(proposalId).get();
    const proposalTitle = proposalSnap.exists
      ? String((proposalSnap.data() as Record<string, unknown>)?.title || "")
      : "";

    const pdfBuffer = await getOrGenerateProposalPdfBuffer(
      authTenantId,
      proposalId,
    );
    const filename = buildFilename(proposalTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    if (res.headersSent) {
      return;
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "PROPOSAL_NOT_FOUND") {
      return res.status(404).json({ message: "Proposta nao encontrada" });
    }
    if (message === "FORBIDDEN_TENANT_MISMATCH") {
      return res.status(403).json({ message: "Acesso negado" });
    }

    console.error("downloadProposalPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
