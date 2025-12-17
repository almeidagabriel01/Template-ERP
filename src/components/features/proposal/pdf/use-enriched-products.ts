
import { useState, useEffect } from "react";
import { Proposal } from "@/services/proposal-service";
import { ProductService } from "@/services/product-service";

export function useEnrichedProducts(proposal: Proposal, tenantId?: string) {
  const [enrichedProducts, setEnrichedProducts] = useState<any[]>(
    proposal.products || []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProductImages = async () => {
      if (!tenantId || !proposal.products?.length) {
        setEnrichedProducts(proposal.products || []);
        setIsLoading(false);
        return;
      }

      try {
        // Get all products from the tenant's catalog
        const catalogProducts = await ProductService.getProducts(tenantId);

        // Create a map for quick lookup
        const productMap = new Map(catalogProducts.map((p) => [p.id, p]));

        // Enrich proposal products with images from catalog
        const enriched = (proposal.products || []).map((proposalProduct) => {
          const catalogProduct = productMap.get(proposalProduct.productId);
          if (catalogProduct) {
            return {
              ...proposalProduct,
              productImage:
                catalogProduct.images?.[0] || catalogProduct.image || "",
              productImages: catalogProduct.images?.length
                ? catalogProduct.images
                : catalogProduct.image
                  ? [catalogProduct.image]
                  : [],
              productDescription:
                catalogProduct.description ||
                proposalProduct.productDescription ||
                "",
            };
          }
          return proposalProduct;
        });

        setEnrichedProducts(enriched);
      } catch (error) {
        console.error("Error loading product images:", error);
        setEnrichedProducts(proposal.products || []);
      } finally {
        setIsLoading(false);
      }
    };

    loadProductImages();
  }, [tenantId, proposal.products]);

  return { products: enrichedProducts, isLoading };
}
