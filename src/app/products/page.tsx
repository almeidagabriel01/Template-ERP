"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";
import { Product, ProductService } from "@/services/product-service";
import { ProposalService } from "@/services/proposal-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// I saw "hook" search earlier had results but didn't list use-toast. 
// I'll use simple window.confirm or the AlertDialog manually without toast for now to be safe, or just console log.
// Better: I'll use the AlertDialog for confirmation as imported above.

export default function ProductsPage() {
    const { tenant } = useTenant();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (tenant) {
            loadProducts();
        }
    }, [tenant]);

    const loadProducts = async () => {
        if (!tenant) return;
        setLoading(true);
        try {
            const data = await ProductService.getProducts(tenant.id);
            setProducts(data);
        } catch (error) {
            console.error("Error loading products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId || !tenant) return;
        try {
            // Check if product is used in any proposal
            const isUsed = await ProposalService.isProductUsedInProposal(tenant.id, deleteId);
            if (isUsed) {
                alert("Não é possível excluir este produto pois ele está vinculado a uma ou mais propostas.");
                setDeleteId(null);
                return;
            }

            await ProductService.deleteProduct(deleteId);
            setProducts(products.filter(p => p.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Erro ao excluir produto. Tente novamente.");
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie o catálogo de produtos, estoque e preços.
                    </p>
                </div>
                <Link href="/products/new">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" /> Novo Produto
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Listagem de Estoque</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar produtos..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10">Carregando...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Nenhum produto encontrado.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Imagem</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Estoque</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            {(product.images?.[0] || product.image) ? (
                                                <img
                                                    src={product.images?.[0] || product.image || ""}
                                                    alt={product.name}
                                                    className="w-10 h-10 object-cover rounded-md"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>{product.category}</TableCell>
                                        <TableCell>{product.sku}</TableCell>
                                        <TableCell>
                                            <span className={Number(product.stock) < 10 ? "text-red-500 font-medium" : ""}>
                                                {product.stock}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            R$ {parseFloat(product.price).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/products/${product.id}`}>
                                                    <Button variant="ghost" size="icon">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <AlertDialog open={deleteId === product.id} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => setDeleteId(product.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Tem certeza que deseja excluir o produto <strong>{product.name}</strong>?
                                                                Essa ação não pode ser desfeita.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                                                                Excluir
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
