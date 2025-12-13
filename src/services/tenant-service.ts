import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from "firebase/firestore";
import { Tenant } from "@/types"; // We can reuse the type or define a new one

const COLLECTION_NAME = "tenants";

export const TenantService = {
  getTenants: async (): Promise<Tenant[]> => {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tenant[];
  },

  getTenantById: async (id: string): Promise<Tenant | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Tenant;
    } else {
      return null;
    }
  },

  createTenant: async (tenant: Omit<Tenant, "id">): Promise<Tenant> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...tenant,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...tenant };
  },

  updateTenant: async (id: string, tenant: Partial<Tenant>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, tenant);
  },

  deleteTenant: async (id: string): Promise<void> => {
    try {
      // 1. Delete all Products related to this tenant
      const productsQ = query(collection(db, "products"), where("tenantId", "==", id));
      const productsSnap = await getDocs(productsQ);
      const productDeletions = productsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(productDeletions);

      // 2. Delete all Proposals related to this tenant
      const proposalsQ = query(collection(db, "proposals"), where("tenantId", "==", id));
      const proposalsSnap = await getDocs(proposalsQ);
      const proposalDeletions = proposalsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(proposalDeletions);

      // 3. Delete all Custom Options related to this tenant
      const optionsQ = query(collection(db, "custom_options"), where("tenantId", "==", id));
      const optionsSnap = await getDocs(optionsQ);
      const optionDeletions = optionsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(optionDeletions);

      // 4. Delete all Users related to this tenant
      const usersQ = query(collection(db, "users"), where("tenantId", "==", id));
      const usersSnap = await getDocs(usersQ);
      // We need to delete the Auth user (server-side) AND the Firestore doc (client/server-side)
      // Since this file is likely used on the client, we import the server action.
      // Next.js handles the bridge.
      const { deleteAuthUser, checkAdminConfig } = await import("@/app/actions/auth");

      // Debug config
      await checkAdminConfig();

      const userDeletions = usersSnap.docs.map(async (doc) => {
        // Try to delete Auth User first (or parallel)
        const result = await deleteAuthUser(doc.id); // Assuming doc.id is the UID
        if (!result.success) {
          console.error(`Failed to delete Auth User ${doc.id}:`, result.error);
        } else {
          console.log(`Auth User ${doc.id} deleted successfully.`);
        }
        return deleteDoc(doc.ref);
      });
      await Promise.all(userDeletions);

      // 5. Finally, delete the Tenant itself
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Error performing cascading delete for tenant:", error);
      throw error;
    }
  },
};
