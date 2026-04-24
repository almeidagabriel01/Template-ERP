import { Router } from "express";
import { createPayment, getPaymentStatus, getMpConfig, processCardPayment } from "../controllers/payment-public.controller";

const router = Router();

router.post("/share/transaction/:token/payment", createPayment);
router.get("/share/transaction/:token/payment/:paymentId/status", getPaymentStatus);
router.get("/share/transaction/:token/mp-config", getMpConfig);
router.post("/share/transaction/:token/process-card", processCardPayment);

export { router as paymentPublicRoutes };
