import React, { createContext, useContext, useEffect } from "react";
import useSWR from "swr";
import { useFacility } from "./FacilityContext";
import { User } from "../types";

const UserContext = createContext<{
  user: User | null;
  setUser: (user: User | null) => void;
} | null>(null);

const fetchUserFromStorage = (): User | null => {
  const storeUser = localStorage.getItem("user");
  //console.log('User pulled from storage:', storeUser);
  if (!storeUser) return null;
  try {
    return JSON.parse(storeUser) as User;
  } catch {
    console.warn("Failed to parse stored user");
    return null;
  }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: user, mutate: setUser } = useSWR('auth-user', fetchUserFromStorage, {
    fallbackData: null,
  });

  const { selectedFacilityId } = useFacility();

  // 🔁 Sync selected facility with user.facilityId
  useEffect(() => {
    if (user && selectedFacilityId && user.facilityId !== selectedFacilityId) {
      const updatedUser = { ...user, facilityId: selectedFacilityId };

      // ✅ Update SWR and localStorage
      setUser(updatedUser, false); // false = don't revalidate
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  }, [selectedFacilityId]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
