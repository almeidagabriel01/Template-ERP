"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useProductActions } from "@/hooks/useProductActions";

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  manufacturer: string;
  category: string;
  sku: string;
  stock: string;
  status: string;
  image: File | null;
  images: File[];
}

interface UseProductFormReturn {
  formData: ProductFormData;
  imagesBase64: string[];
  isSubmitting: boolean;
  showLimitModal: boolean;
  setShowLimitModal: (value: boolean) => void;
  currentProductCount: number;
  maxProducts: number;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleAddImage: (file: File | null) => void;
  handleRemoveImage: (index: number) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useProductForm(
  initialData?: Product,
  productId?: string
): UseProductFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProduct, getProductCount, features } = usePlanLimits();
  const { createProduct } = useProductActions();

  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [currentProductCount, setCurrentProductCount] = React.useState(0);

  const [formData, setFormData] = React.useState<ProductFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || "",
    manufacturer: initialData?.manufacturer || "",
    category: initialData?.category || "",
    sku: initialData?.sku || "",
    stock: initialData?.stock || "",
    status: initialData?.status || "active",
    image: null,
    images: [],
  });

  const [imagesBase64, setImagesBase64] = React.useState<string[]>(
    initialData?.images || (initialData?.image ? [initialData.image] : [])
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Update form data if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        name: initialData.name || "",
        description: initialData.description || "",
        price: initialData.price || "",
        manufacturer: initialData.manufacturer || "",
        category: initialData.category || "",
        sku: initialData.sku || "",
        stock: initialData.stock || "",
        status: initialData.status || "active",
        images: [],
      }));

      const existingImages =
        initialData.images || (initialData.image ? [initialData.image] : []);
      setImagesBase64(existingImages);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddImage = (file: File | null) => {
    if (!file) return;

    // Validation: Max 3 images
    if (imagesBase64.length >= 3) {
      alert("Máximo de 3 imagens permitido.");
      return;
    }

    // Validation: Total size limit (900KB safe limit for Firestore 1MB doc)
    const currentTotalSize = imagesBase64.reduce(
      (acc, img) => acc + (img.length * 3) / 4,
      0
    );
    const newImageSize = file.size;

    if (currentTotalSize + newImageSize > 900 * 1024) {
      alert(
        "O tamanho total das imagens não pode exceder 900KB (Restrição do Banco de Dados). Tente imagens menores."
      );
      return;
    }

    setFormData((prev) => ({ ...prev, images: [...prev.images, file] }));

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImagesBase64((prev) => [...prev, e.target!.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    const newPreviews = [...imagesBase64];
    newPreviews.splice(index, 1);
    setImagesBase64(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check product limit only for NEW products
    if (!productId) {
      const canCreate = await canCreateProduct();
      if (!canCreate) {
        const count = await getProductCount();
        setCurrentProductCount(count);
        setShowLimitModal(true);
        return;
      }
    }

    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    // Validate Total Size
    const totalSize = imagesBase64.reduce(
      (acc, img) => acc + (img.length * 3) / 4,
      0
    );
    if (totalSize > 900 * 1024) {
      alert(
        "O tamanho total das imagens excede o limite de 900KB. Remova algumas imagens."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const dataToSave = {
        tenantId: tenant.id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        manufacturer: formData.manufacturer,
        category: formData.category,
        sku: formData.sku,
        stock: formData.stock,
        status: formData.status as "active" | "inactive",
        images: imagesBase64,
      };

      if (productId) {
        await ProductService.updateProduct(productId, dataToSave);
        alert("Produto atualizado com sucesso!");
        router.push("/products");
        router.refresh();
      } else {
        const result = await createProduct({
          name: formData.name,
          description: formData.description,
          price: formData.price,
          manufacturer: formData.manufacturer,
          category: formData.category,
          sku: formData.sku,
          stock: formData.stock,
          images: imagesBase64,
        });

        if (result?.success) {
          router.push("/products");
          router.refresh();
        }
      }
    } catch (error) {
      // Hook handles logging and toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    imagesBase64,
    isSubmitting,
    showLimitModal,
    setShowLimitModal,
    currentProductCount,
    maxProducts: features?.maxProducts || 0,
    handleChange,
    handleAddImage,
    handleRemoveImage,
    handleSubmit,
  };
}
