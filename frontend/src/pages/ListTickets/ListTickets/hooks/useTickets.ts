// src/pages/ListTickets/hooks/useTickets.ts
import { useEffect } from "react";
import useSWR from "swr";
import { fetchTickets } from "@/services";
import { Ticket, TicketFilters } from "@/types";
import { useFacility } from "@/context/FacilityContext";
import { useFilteredStore } from "@/hooks/useFilteredStore";

type DataShape = {
  tickets: Ticket[];
  currentPage: number;
  totalPages: number;
  totalTickets: number;
};

export const useTickets = () => {
  const { selectedFacilityId } = useFacility();
  const { filters, pagination, setPagination, applyFilter } =
    useFilteredStore<TicketFilters, Ticket>();

  const { data, error, isLoading, isValidating, mutate } = useSWR<DataShape>(
    ["tickets", selectedFacilityId || "none", filters, pagination.page, pagination.pageSize],
    ([, fid, f, page, size]) =>
      fetchTickets(
        fid === "none" ? undefined : (fid as string),
        f as TicketFilters,
        page as number,
        size as number
      ),
    {
      dedupingInterval: 0,
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  // sync pagination + (optional) cache list in the store
  useEffect(() => {
    if (!data) return;
    const { currentPage, totalPages, totalTickets, tickets } = data;

    if (
      pagination.page !== currentPage ||
      pagination.totalPages !== totalPages ||
      pagination.totalCount !== totalTickets
    ) {
      setPagination({ page: currentPage, totalPages, totalCount: totalTickets });
    }

    // Optional: keep a cached copy tagged as "tickets"
    applyFilter("tickets", tickets ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return {
    tickets: data?.tickets ?? [],
    totalPages: data?.totalPages ?? 1,
    totalCount: data?.totalTickets ?? 0,
    pagination,
    setPagination,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
};