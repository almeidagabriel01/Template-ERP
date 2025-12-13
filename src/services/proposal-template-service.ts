import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from "firebase/firestore";
import { ProposalTemplate } from "@/types";

const COLLECTION_NAME = "proposal_templates";

export const ProposalTemplateService = {
    getTemplates: async (tenantId: string): Promise<ProposalTemplate[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ProposalTemplate));
        } catch (error) {
            console.error("Error fetching templates:", error);
            throw error;
        }
    },

    getTemplateById: async (id: string): Promise<ProposalTemplate | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as ProposalTemplate;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching template:", error);
            throw error;
        }
    },

    createTemplate: async (data: Omit<ProposalTemplate, "id">): Promise<ProposalTemplate> => {
        try {
            // If setting as default, we should probably unset others, but for simplicity let's just add for now
            // Detailed logic for "ensuring only one default" can be added here or in the UI handler
            // For robust backend, a transaction would be best.

            const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error creating template:", error);
            throw error;
        }
    },

    updateTemplate: async (id: string, data: Partial<Omit<ProposalTemplate, "id">>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating template:", error);
            throw error;
        }
    },

    deleteTemplate: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting template:", error);
            throw error;
        }
    },

    // Helper to get the default template or the first one found
    getDefaultTemplate: async (tenantId: string): Promise<ProposalTemplate | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId),
                where("isDefault", "==", true)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() } as ProposalTemplate;
            }

            // Fallback to any template
            const all = await ProposalTemplateService.getTemplates(tenantId);
            return all.length > 0 ? all[0] : null;
        } catch (error) {
            console.error("Error fetching default template:", error);
            return null;
        }
    }
};
