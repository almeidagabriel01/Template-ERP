"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { TransactionType } from "@/services/transaction-service";

interface TransactionFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterType: TransactionType | "all";
  onFilterChange: (type: TransactionType | "all") => void;
}

export function TransactionFilters({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição, cliente ou categoria..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant={filterType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("all")}
        >
          Todos
        </Button>
        <Button
          variant={filterType === "income" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("income")}
          className="gap-1"
        >
          <ArrowUpCircle className="w-4 h-4" />
          Receitas
        </Button>
        <Button
          variant={filterType === "expense" ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange("expense")}
          className="gap-1"
        >
          <ArrowDownCircle className="w-4 h-4" />
          Despesas
        </Button>
      </div>
    </div>
  );
}
