import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Business } from '../types/index.ts';

interface AuthContextType {
  currentUser: User | null;
  business: Business | null;
  users: User[];
  isLoading: boolean;
  switchUser: (userId: string) => Promise<void>;
  refreshBusiness: () => Promise<void>;
  isOwner: boolean;
  isCashier: boolean;
  isInventoryManager: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canManageInventory: boolean;
  canManageCustomers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [userRes, usersRes, bizRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/auth/users'),
        fetch('/api/business'),
      ]);

      const userData = await userRes.json();
      const usersData = await usersRes.json();
      const bizData = await bizRes.json();

      if (userData.success) setCurrentUser(userData.user);
      if (usersData.success) setUsers(usersData.users);
      if (bizData.success) setBusiness(bizData.business);
    } catch (err) {
      console.error('Failed to load auth data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const switchUser = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const refreshBusiness = async () => {
    try {
      const res = await fetch('/api/business');
      const data = await res.json();
      if (data.success) setBusiness(data.business);
    } catch (err) {
      console.error('Failed to refresh business settings:', err);
    }
  };

  const role = currentUser?.role;
  const isOwner = role === 'owner';
  const isCashier = role === 'cashier';
  const isInventoryManager = role === 'inventory_manager';

  // Strict RBAC permissions
  const canManageSettings = isOwner;
  const canViewReports = isOwner;
  const canManageInventory = isOwner || isInventoryManager;
  const canManageCustomers = true; // All roles can register or view customer details

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        business,
        users,
        isLoading,
        switchUser,
        refreshBusiness,
        isOwner,
        isCashier,
        isInventoryManager,
        canManageSettings,
        canViewReports,
        canManageInventory,
        canManageCustomers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
