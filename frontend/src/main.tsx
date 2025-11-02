import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "./context/UserContext";
import { FilteredDataProvider } from "./hooks/useFilteredStore"
import App from "./App";
import "./styles/index.css";
import { FacilityProvider } from "./context/FacilityContext";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FacilityProvider>
      <UserProvider>
        <QueryClientProvider client={queryClient}>
          <FilteredDataProvider>
            <App />
          </FilteredDataProvider>
        </QueryClientProvider>
      </UserProvider>
    </FacilityProvider>
  </React.StrictMode>
);
