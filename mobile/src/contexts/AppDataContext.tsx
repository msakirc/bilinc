import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Category } from '../types';
import { DatabaseService } from '../services/database';

interface AppDataContextType {
  // Root categories (parent_id is null)
  categories: Category[];
  // All categories including subcategories
  allCategories: Category[];
  // Subcategories indexed by parent_id for easy lookup
  subcategoriesMap: { [parentId: string]: Category[] };
  // Loading states
  loading: boolean;
  categoriesLoaded: boolean;
  // Refresh function
  refreshCategories: () => Promise<void>;
  // Get subcategories for a specific category
  getSubcategories: (parentId: string) => Category[];
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

interface AppDataProviderProps {
  children: ReactNode;
}

export function AppDataProvider({ children }: AppDataProviderProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subcategoriesMap, setSubcategoriesMap] = useState<{ [parentId: string]: Category[] }>({});
  const [loading, setLoading] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  
  // Ref to prevent multiple fetches
  const fetchInitiated = useRef(false);

  const loadCategories = async () => {
    // Prevent double fetching
    if (fetchInitiated.current) return;
    fetchInitiated.current = true;
    
    setLoading(true);
    
    try {
      // Fetch ALL categories (both parent and children) with listing counts
      // getCategoriesForType with p_parent_only=false returns all categories
      const allCats = await DatabaseService.getCategoriesForType('business', false);
      
      if (allCats && allCats.length > 0) {
        // Store all categories
        setAllCategories(allCats);
        
        // Separate root categories (no parent_id)
        const rootCats = allCats.filter((cat: Category) => !cat.parent_id);
        setCategories(rootCats);
        
        // Build subcategories map indexed by parent_id
        const subMap: { [parentId: string]: Category[] } = {};
        allCats.forEach((cat: Category) => {
          if (cat.parent_id) {
            if (!subMap[cat.parent_id]) {
              subMap[cat.parent_id] = [];
            }
            subMap[cat.parent_id].push(cat);
          }
        });
        setSubcategoriesMap(subMap);
        
        console.log(`📂 Categories loaded: ${rootCats.length} root categories, ${allCats.length - rootCats.length} subcategories`);
      } else {
        setCategories([]);
        setAllCategories([]);
        console.log('📂 No categories returned');
      }
    } catch (error) {
      console.log('📂 Categories RPC unavailable');
      setCategories([]);
      setAllCategories([]);
    } finally {
      setLoading(false);
      setCategoriesLoaded(true);
    }
  };

  const refreshCategories = async () => {
    fetchInitiated.current = false; // Allow refetch
    await loadCategories();
  };

  const getSubcategories = (parentId: string): Category[] => {
    return subcategoriesMap[parentId] || [];
  };

  // Load categories once when provider mounts (app startup)
  useEffect(() => {
    // Fire and forget - don't block app startup
    loadCategories();
  }, []);

  return (
    <AppDataContext.Provider value={{ 
      categories, 
      allCategories,
      subcategoriesMap,
      loading, 
      categoriesLoaded,
      refreshCategories,
      getSubcategories
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}