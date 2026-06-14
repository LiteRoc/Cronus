import apiClient from "./apiClient";
import { mutate } from "swr";
import { User } from "@/types";

// Login API call
export const loginUser = async (
  email: string,
  password: string
): Promise<{ token: string; user: User }> => {
  const response = await apiClient.post("/auth/login", { email, password });
  const { token, user } = response.data;
  
  return { token, user };
};

// Logout User
export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("selectedFacilityId");
  sessionStorage.clear();

  mutate(() => true, undefined, { revalidate: false });
};
