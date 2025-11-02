import React, { createContext, useContext } from "react";
import { getFacilities } from "../services/facilityAPI";
import { Facility } from "../types/";
import useSWR from "swr";

interface FacilityContextType {
  selectedFacilityId: string | null;
  setSelectedFacilityId: (id: string) => void;
  availableFacilities: Facility[];
  setAvailableFacilities: (facilities: Facility[]) => void;
  loading: boolean;
}

const FacilityContext = createContext<FacilityContextType | undefined>(undefined);

const SELECTED_FACILITY_KEY = "selectedFacilityId";
const FACILITIES_KEY = "availableFacilities";

const getAllFacilities = async (): Promise<Facility[]> => {
  return await getFacilities();
}
// SWR fetchers from localStorage
const getStoredFacilityId = () => localStorage.getItem(SELECTED_FACILITY_KEY);
const getStoredFacilities = async (): Promise<Facility[]> => {
  const userRaw = localStorage.getItem("user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  if (user.role === "admin") {
    return await getAllFacilities();
  }

  const facilities =  user?.facilities ?? [];
  // Normalize `id` to `_id` if needed
  return facilities.map((f: any) =>
    f._id ? f : { _id: f.id, name: f.name }  // fallback
  );
};

export const FacilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: selectedFacilityId, mutate: setSelectedFacilityId } = useSWR(
    SELECTED_FACILITY_KEY,
    getStoredFacilityId
  );

  const { data: availableFacilities, mutate: setAvailableFacilities, isLoading: loading } = useSWR(
    FACILITIES_KEY,
    getStoredFacilities
  );

  const updateFacilityId = (id: string) => {
    localStorage.setItem(SELECTED_FACILITY_KEY, id);
    setSelectedFacilityId(id);
  };

  const updateFacilities = (facilities: Facility[]) => {
    localStorage.setItem(FACILITIES_KEY, JSON.stringify(facilities));
    setAvailableFacilities(facilities);
  };

  return (
    <FacilityContext.Provider
      value={{
        selectedFacilityId: selectedFacilityId ?? null,
        setSelectedFacilityId: updateFacilityId,
        availableFacilities: availableFacilities  ?? [],
        setAvailableFacilities: updateFacilities,
        loading
      }}
    >
      {children}
    </FacilityContext.Provider>
  );
};

export const useFacility = (): FacilityContextType => {
  const context = useContext(FacilityContext);
  if (!context) {
    throw new Error("useFacility must be used within a FacilityProvider");
  }
  return context;
};