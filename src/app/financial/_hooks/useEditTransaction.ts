"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { useRouter, useParams } from "next/navigation";
import {
  TransactionService,
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { usePagePermission } from "@/hooks/usePagePermission";

export interface EditTransactionFormData {
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
  notes: string;
}

interface UseEditTransactionReturn {
  formData: EditTransactionFormData;
  setFormData: React.Dispatch<React.SetStateAction<EditTransactionFormData>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleClientChange: (data: { clientId?: string; clientName: string; isNew: boolean }) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  transaction: Transaction | null;
  relatedInstallments: Transaction[];
  transactionId: string;
  isLoading: boolean;
  isSaving: boolean;
  canEdit: boolean;
  canView: boolean;
}

export function useEditTransaction(): UseEditTransactionReturn {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;
  const { canEdit, canView, isLoading: permLoading } = usePagePermission("financial");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [transaction, setTransaction] = React.useState<Transaction | null>(null);
  const [relatedInstallments, setRelatedInstallments] = React.useState<Transaction[]>([]);

  const [formData, setFormData] = React.useState<EditTransactionFormData>({
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
    notes: "",
  });

  // Redirect if no permission
  React.useEffect(() => {
    if (!permLoading && !canView) {
      router.push("/financial");
    }
  }, [permLoading, canView, router]);

  // Fetch transaction data
  React.useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const data = await TransactionService.getTransactionById(transactionId);
        if (data) {
          setTransaction(data);
          setFormData({
            type: data.type,
            description: data.description,
            amount: data.amount.toString(),
            date: data.date.split("T")[0],
            dueDate: data.dueDate?.split("T")[0] || "",
            status: data.status,
            clientId: data.clientId,
            clientName: data.clientName || "",
            category: data.category || "",
            wallet: data.wallet || "",
            notes: data.notes || "",
          });

          // If this is an installment, fetch all related installments
          if (data.isInstallment && data.installmentGroupId) {
            const allTransactions = await TransactionService.getTransactions(data.tenantId);
            const related = allTransactions
              .filter((t) => t.installmentGroupId === data.installmentGroupId)
              .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
            setRelatedInstallments(related);
          }
        }
      } catch (error) {
        console.error("Error fetching transaction:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (transactionId) {
      fetchTransaction();
    }
  }, [transactionId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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

    if (!formData.description.trim() || !formData.amount) {
      toast.error("Preencha a descrição e o valor!");
      return;
    }

    setIsSaving(true);

    try {
      await TransactionService.updateTransaction(transactionId, {
        type: formData.type,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        date: formData.date,
        dueDate: formData.dueDate || undefined,
        status: formData.status,
        clientId: formData.clientId,
        clientName: formData.clientName || undefined,
        category: formData.category || undefined,
        wallet: formData.wallet || undefined,
        notes: formData.notes || undefined,
      });

      toast.success("Lançamento atualizado com sucesso!");
      router.push("/financial");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Erro ao atualizar lançamento");
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
    transaction,
    relatedInstallments,
    transactionId,
    isLoading: isLoading || permLoading,
    isSaving,
    canEdit,
    canView,
  };
}
