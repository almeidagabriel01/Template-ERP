"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditLimitsDialog } from "@/components/admin/edit-limits-dialog";
import { useTenantsData } from "./_hooks/useTenantsData";
import { TenantsMetricsCards, TenantsTable } from "./_components";

export default function AdminTenantsPage() {
  const router = useRouter();
  const {
    isLoading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredData,
    metrics,
    editDialog,
    setEditDialog,
    handleEditLimits,
    loadData,
  } = useTenantsData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-screen w-full bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse">
            Carregando dados das empresas...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Gestão de Empresas
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa de todos os inquilinos, recursos e utilização.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Lista
          </Button>
        </div>
      </div>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Metrics Cards */}
        <TenantsMetricsCards metrics={metrics} />

        {/* Main Table */}
        <TenantsTable
          filteredData={filteredData}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          onEditLimits={handleEditLimits}
        />
      </main>

      <EditLimitsDialog
        open={editDialog.open}
        onClose={() => setEditDialog((prev) => ({ ...prev, open: false }))}
        tenantId={editDialog.tenantId}
        tenantName={editDialog.tenantName}
        currentFeatures={editDialog.features}
        onSaved={loadData}
      />
    </div>
  );
}
