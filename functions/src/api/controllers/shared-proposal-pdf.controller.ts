"use strict";

import { Request, Response } from "express";
import { SharedProposalService } from "../services/shared-proposal.service";
import { getOrGenerateProposalPdfBuffer } from "../services/proposal-pdf.service";
import { db } from "../../init";

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "").trim();
}

function buildFilename(title?: string): string {
  const clean = sanitizeFilename(title || "");
  return clean ? `Proposta - ${clean}.pdf` : "Proposta.pdf";
}

/**
 * GET /v1/share/:token/pdf
 * Public endpoint — downloads the PDF for a shared proposal.
 * The share token acts as authentication (no Bearer token required).
 */
export async function downloadSharedProposalPdf(req: Request, res: Response) {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    const sharedProposal = await SharedProposalService.getSharedProposal(token);
    if (!sharedProposal) {
      return res
        .status(404)
        .json({ message: "Link não encontrado ou inválido" });
    }

    // Fetch proposal title for filename
    const proposalSnap = await db
      .collection("proposals")
      .doc(sharedProposal.proposalId)
      .get();
    const proposalTitle = proposalSnap.exists
      ? String((proposalSnap.data() as Record<string, unknown>)?.title || "")
      : "";

    const pdfBuffer = await getOrGenerateProposalPdfBuffer(
      sharedProposal.tenantId,
      sharedProposal.proposalId,
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

    if (message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsável.",
        code: "EXPIRED_LINK",
      });
    }
    if (message === "PROPOSAL_NOT_FOUND") {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    console.error("downloadSharedProposalPdf Error:", error);
    return res.status(500).json({ message: "Erro ao gerar PDF" });
  }
}
