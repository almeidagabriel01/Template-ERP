import { Router } from "express";
import * as SharedProposalsController from "../controllers/shared-proposals.controller";
import { downloadSharedProposalPdf } from "../controllers/shared-proposal-pdf.controller";

const router = Router();

/**
 * Rota pública para acessar proposta via token
 * Sem middleware de autenticação
 */
router.get("/share/:token", SharedProposalsController.getSharedProposal);

/**
 * Rota pública para baixar PDF de proposta compartilhada via token
 * Sem middleware de autenticação — o token é a autenticação
 */
router.get("/share/:token/pdf", downloadSharedProposalPdf);

export default router;
