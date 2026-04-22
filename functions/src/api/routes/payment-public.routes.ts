import { Router } from "express";
import { createPayment, getPaymentStatus } from "../controllers/payment-public.controller";

const router = Router();

router.post("/share/transaction/:token/payment", createPayment);
router.get("/share/transaction/:token/payment/:paymentId/status", getPaymentStatus);

export { router as paymentPublicRoutes };
