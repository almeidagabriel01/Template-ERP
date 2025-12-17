"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { ArrowLeft, Loader2, Save, CreditCard } from "lucide-react";
import { useEditTransaction } from "../_hooks/useEditTransaction";
import {
  TypeSelectorCard,
  DetailsCard,
  ClientCard,
  NotesCard,
  InstallmentsCard,
} from "../_components";
import { TransactionFormData } from "../_hooks/useTransactionForm";

export default function EditTransactionPage() {
  const router = useRouter();
  const {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    transaction,
    relatedInstallments,
    transactionId,
    isLoading,
    isSaving,
    canEdit,
  } = useEditTransaction();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Lançamento não encontrado</p>
        <Button variant="outline" onClick={() => router.push("/financial")}>
          Voltar para Financeiro
        </Button>
      </div>
    );
  }

  // Adapt formData type for shared components (they expect TransactionFormData)
  const adaptedFormData: TransactionFormData = {
    ...formData,
    isInstallment: false,
    installmentCount: 2,
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/financial")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {canEdit ? "Editar Lançamento" : "Visualizar Lançamento"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {canEdit
              ? "Atualize as informações do lançamento"
              : "Visualizando informações do lançamento"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <TypeSelectorCard
          type={formData.type}
          onTypeChange={(type) => setFormData((prev) => ({ ...prev, type }))}
        />

        <DetailsCard formData={adaptedFormData} onChange={handleChange} />

        {/* Wallet Card - simpler version without installments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicSelect
              storageKey="wallets"
              label="Carteira / Forma de Pagamento"
              name="wallet"
              value={formData.wallet}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        {/* Related Installments */}
        <InstallmentsCard
          installments={relatedInstallments}
          currentTransactionId={transactionId}
        />

        <ClientCard
          clientName={formData.clientName}
          clientId={formData.clientId}
          onClientChange={handleClientChange}
        />

        <NotesCard notes={formData.notes} onChange={handleChange} />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/financial")}
          >
            {canEdit ? "Cancelar" : "Voltar"}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
