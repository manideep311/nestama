"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PetDTO, PetInput, PetRecommendationsDTO } from "@nestama/shared";
import { apiFetch } from "./cart-client";

// Under the "account" prefix, so signing out (SessionSync) drops them with the rest.
export const petKeys = {
  all: ["account", "pets"] as const,
  picks: (petId: string) => ["account", "pets", petId, "picks"] as const,
};

export function usePets(enabled = true) {
  return useQuery({ queryKey: petKeys.all, queryFn: () => apiFetch<PetDTO[]>("/account/pets"), enabled });
}

export function usePetPicks(petId: string, enabled = true) {
  return useQuery({
    queryKey: petKeys.picks(petId),
    queryFn: () => apiFetch<PetRecommendationsDTO>(`/account/pets/${encodeURIComponent(petId)}/recommendations`),
    enabled,
    staleTime: 5 * 60_000,
    // Switching between pets keeps the last picks on screen until the next ones arrive.
    placeholderData: keepPreviousData,
  });
}

export function useSavePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: PetInput }) =>
      apiFetch<PetDTO>(id ? `/account/pets/${encodeURIComponent(id)}` : "/account/pets", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      }),
    // Age, life stage or species may have changed, so the picks refresh too.
    onSuccess: () => qc.invalidateQueries({ queryKey: petKeys.all }),
  });
}

export function useDeletePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: true }>(`/account/pets/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: petKeys.all }),
  });
}
