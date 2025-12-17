"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useTransactionForm } from "../_hooks/useTransactionForm";
import {
  TypeSelectorCard,
  DetailsCard,
  PaymentCard,
  ClientCard,
  NotesCard,
} from "../_components";

export default function NewTransactionPage() {
  const router = useRouter();
  const {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    isSaving,
    isLoading,
  } = useTransactionForm();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Lançamento</h1>
          <p className="text-muted-foreground text-sm">
            Registre uma receita ou despesa
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <TypeSelectorCard
          type={formData.type}
          onTypeChange={(type) => setFormData((prev) => ({ ...prev, type }))}
        />

        <DetailsCard formData={formData} onChange={handleChange} />

        <PaymentCard
          formData={formData}
          onFormDataChange={setFormData}
          onChange={handleChange}
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
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {formData.isInstallment
                  ? `Criar ${formData.installmentCount} Parcelas`
                  : "Salvar Lançamento"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
