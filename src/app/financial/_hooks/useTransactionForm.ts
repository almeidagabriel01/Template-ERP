"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import {
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import { useClientActions } from "@/hooks/useClientActions";
import { usePagePermission } from "@/hooks/usePagePermission";

export interface TransactionFormData {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  dueDate: string;
  status: TransactionStatus;
  clientId: string | undefined;
  clientName: string;
  category: string;
  wallet: string;
  isInstallment: boolean;
  installmentCount: number;
  notes: string;
}

const initialFormData: TransactionFormData = {
  type: "income",
  description: "",
  amount: "",
  date: "",
  dueDate: "",
  status: "pending",
  clientId: undefined,
  clientName: "",
  category: "",
  wallet: "",
  isInstallment: false,
  installmentCount: 2,
  notes: "",
};

interface UseTransactionFormReturn {
  formData: TransactionFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleClientChange: (data: { clientId?: string; clientName: string; isNew: boolean }) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  isSaving: boolean;
  canCreate: boolean;
  isLoading: boolean;
}

export function useTransactionForm(): UseTransactionFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreate, isLoading: permLoading } = usePagePermission("financial");
  const { createClient } = useClientActions();
  const [formData, setFormData] = React.useState<TransactionFormData>(initialFormData);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!permLoading && !canCreate) {
      router.push("/financial");
    }
  }, [permLoading, canCreate, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleClientChange = (data: { clientId?: string; clientName: string; isNew: boolean }) => {
    setFormData((prev) => ({
      ...prev,
      clientId: data.clientId,
      clientName: data.clientName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant) {
      toast.error("Erro: Nenhuma empresa selecionada!");
      return;
    }

    if (!formData.description.trim() || !formData.amount) {
      toast.error("Preencha a descrição e o valor!");
      return;
    }

    setIsSaving(true);

    try {
      let clientId = formData.clientId;
      if (!clientId && formData.clientName.trim()) {
        const newClientResult = await createClient({
          name: formData.clientName,
          source: 'financial'
        });

        if (newClientResult?.success && newClientResult.clientId) {
          clientId = newClientResult.clientId;
        } else {
          setIsSaving(false);
          return;
        }
      }

      const now = new Date().toISOString();
      const baseAmount = parseFloat(formData.amount);

      if (formData.isInstallment && formData.installmentCount > 1) {
        const installmentGroupId = `installment_${Date.now()}`;
        const installmentAmount = baseAmount / formData.installmentCount;
        const baseDate = new Date(formData.date);

        for (let i = 0; i < formData.installmentCount; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(installmentDate.getMonth() + i);

          await TransactionService.createTransaction({
            tenantId: tenant.id,
            type: formData.type,
            description: formData.description.trim(),
            amount: Math.round(installmentAmount * 100) / 100,
            date: installmentDate.toISOString().split("T")[0],
            dueDate: installmentDate.toISOString().split("T")[0],
            status: i === 0 ? formData.status : "pending",
            clientId,
            clientName: formData.clientName || undefined,
            category: formData.category || undefined,
            wallet: formData.wallet || undefined,
            isInstallment: true,
            installmentCount: formData.installmentCount,
            installmentNumber: i + 1,
            installmentGroupId,
            notes: formData.notes || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        await TransactionService.createTransaction({
          tenantId: tenant.id,
          type: formData.type,
          description: formData.description.trim(),
          amount: baseAmount,
          date: formData.date,
          dueDate: formData.dueDate || undefined,
          status: formData.status,
          clientId,
          clientName: formData.clientName || undefined,
          category: formData.category || undefined,
          wallet: formData.wallet || undefined,
          notes: formData.notes || undefined,
          createdAt: now,
          updatedAt: now,
        });
      }

      toast.success("Lançamento criado com sucesso!");
      router.push("/financial");
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast.error("Erro ao criar lançamento");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    isSaving,
    canCreate,
    isLoading: permLoading,
  };
}
