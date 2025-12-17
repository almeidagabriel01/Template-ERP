"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { Search, MoreHorizontal, Mail } from "lucide-react";
import { TenantBillingInfo } from "@/services/admin-service";

interface TenantsTableProps {
  filteredData: TenantBillingInfo[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  onEditLimits: (item: TenantBillingInfo) => void;
}

function formatLimit(current: number, max: number | undefined) {
  if (max === -1 || max === undefined) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-semibold">{current}</span>
        <span className="text-muted-foreground text-xs">/ ∞</span>
      </div>
    );
  }
  const isNearLimit = max > 0 && current >= max * 0.9;
  return (
    <div
      className={`flex items-center gap-1 ${isNearLimit ? "text-amber-600" : ""}`}
    >
      <span className="font-semibold">{current}</span>
      <span className="text-muted-foreground text-xs">/ {max}</span>
    </div>
  );
}

export function TenantsTable({
  filteredData,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  onEditLimits,
}: TenantsTableProps) {
  return (
    <Card className="shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Diretório de Empresas</CardTitle>
          <CardDescription>
            Gerencie acessos, planos e utilização de recursos
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou email..."
              className="pl-8 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-9 w-[130px]"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="free">Gratuito</option>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Propostas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.tenant.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{item.tenant.name}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {item.admin.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {item.planName}
                      </Badge>
                      {item.billingInterval === "yearly" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 px-1.5"
                        >
                          Anual
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatLimit(item.usage.users, item.planFeatures?.maxUsers)}
                  </TableCell>
                  <TableCell>
                    {formatLimit(
                      item.usage.products,
                      item.planFeatures?.maxProducts
                    )}
                  </TableCell>
                  <TableCell>
                    {formatLimit(
                      item.usage.clients,
                      item.planFeatures?.maxClients
                    )}
                  </TableCell>
                  <TableCell>
                    {formatLimit(
                      item.usage.proposals,
                      item.planFeatures?.maxProposals
                    )}
                  </TableCell>
                  <TableCell>
                    {item.subscriptionStatus === "active" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-200 shadow-none">
                        Ativo
                      </Badge>
                    ) : item.subscriptionStatus === "free" ? (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground"
                      >
                        Gratuito
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-rose-500/15 text-rose-600 border-rose-200"
                      >
                        Cancelado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            navigator.clipboard.writeText(item.admin.id)
                          }
                        >
                          Copiar ID Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigator.clipboard.writeText(item.tenant.id)
                          }
                        >
                          Copiar ID Empresa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEditLimits(item)}>
                          Editar Limites
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="border-t p-4 text-xs text-muted-foreground flex justify-between">
        <span>Total de {filteredData.length} empresas</span>
        <span>Atualizado em tempo real</span>
      </CardFooter>
    </Card>
  );
}
