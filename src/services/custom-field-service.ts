import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from "firebase/firestore";
import { CustomFieldType, CustomFieldItem } from "@/types";

const COLLECTION_NAME = "custom_fields";

export const CustomFieldService = {
    getCustomFieldTypes: async (tenantId: string): Promise<CustomFieldType[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CustomFieldType));
        } catch (error) {
            console.error("Error fetching custom field types:", error);
            throw error;
        }
    },

    getCustomFieldTypeById: async (id: string): Promise<CustomFieldType | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as CustomFieldType;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching custom field type:", error);
            throw error;
        }
    },

    createCustomFieldType: async (data: Omit<CustomFieldType, "id">): Promise<CustomFieldType> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error creating custom field type:", error);
            throw error;
        }
    },

    updateCustomFieldType: async (id: string, data: Partial<Omit<CustomFieldType, "id">>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating custom field type:", error);
            throw error;
        }
    },

    deleteCustomFieldType: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting custom field type:", error);
            throw error;
        }
    }
};
