"use client";

import * as React from "react";
import { Ambiente } from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Trash2, Home, Plus, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AmbienteListProps {
  ambientes: Ambiente[];
  onUpdate: () => void;
}

export function AmbienteList({ ambientes, onUpdate }: AmbienteListProps) {
  const { tenant } = useTenant();

  // Create State
  const [newAmbienteName, setNewAmbienteName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Edit State
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Handlers
  const handleCreate = async () => {
    if (!tenant?.id || !newAmbienteName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const nextOrder = await AmbienteService.getNextOrder(tenant.id);
      await AmbienteService.createAmbiente({
        tenantId: tenant.id,
        name: newAmbienteName.trim(),
        icon: "Home",
        order: nextOrder,
        createdAt: new Date().toISOString(),
      });
      setNewAmbienteName("");
      toast.success("Ambiente criado com sucesso!");
      onUpdate();
    } catch (error) {
      console.error("Error creating ambiente:", error);
      toast.error("Erro ao criar ambiente");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setIsUpdating(true);
    try {
      await AmbienteService.updateAmbiente(id, { name: editingName.trim() });
      setEditingId(null);
      setEditingName("");
      toast.success("Ambiente atualizado!");
      onUpdate();
    } catch (error) {
      console.error("Error updating ambiente:", error);
      toast.error("Erro ao atualizar ambiente");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await AmbienteService.deleteAmbiente(deletingId);
      toast.success("Ambiente excluído!");
      onUpdate();
    } catch (error) {
      console.error("Error deleting ambiente:", error);
      toast.error("Erro ao excluir ambiente");
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setDeleteConfirmOpen(false);
    }
  };

  const startEdit = (amb: Ambiente) => {
    setEditingId(amb.id);
    setEditingName(amb.name);
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted/20 p-4 rounded-lg border">
        <h3 className="font-medium mb-2">Adicionar Novo Ambiente</h3>
        <div className="flex items-center gap-2">
          <Input
            id="new-ambiente-input"
            placeholder="Nome do ambiente (ex: Sala, Quarto, Cozinha)"
            value={newAmbienteName}
            onChange={(e) => setNewAmbienteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <Button
            onClick={handleCreate}
            disabled={!newAmbienteName.trim() || isCreating}
            id="trigger-new-ambiente"
          >
            {isCreating ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Adicionar
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {ambientes.map((amb) => (
          <div
            key={amb.id}
            className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <Home className="h-4 w-4 text-primary shrink-0" />
              {editingId === amb.id ? (
                <div className="flex gap-2 flex-1 max-w-sm">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleEdit(amb.id)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Spinner className="h-3 w-3" /> : "Salvar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <span className="font-medium">{amb.name}</span>
              )}
            </div>

            {editingId !== amb.id && (
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEdit(amb)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingId(amb.id);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {ambientes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum ambiente encontrado.
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ambiente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o ambiente da lista global. Sistemas que usam
              este ambiente podem ficar com referências quebradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
