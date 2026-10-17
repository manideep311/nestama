"use client";

import { Cake, Cat, Dog, PawPrint, Plus } from "lucide-react";
import { LIFE_STAGE_LABEL, MAX_PETS, type PetDTO } from "@nestama/shared";
import { useDeletePet, usePets } from "@/lib/pets-client";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { Modal, useModalTarget } from "@/components/ui/Modal";
import { EmptyState, ErrorState, PageHeading } from "@/components/account/AccountViews";
import { PetForm } from "./PetForm";
import { PetPicks } from "./PetPicks";

const birthdayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "UTC" });

/** "Dog · About 3 years · Adult", "Cat · Under a year · Kitten". */
export function petSummary(pet: PetDTO): string {
  const kind = pet.species === "DOG" ? "Dog" : "Cat";
  const years = `${pet.ageYears} ${pet.ageYears === 1 ? "year" : "years"}`;
  const age = pet.ageYears === 0 ? "Under a year" : pet.birthDateEstimated ? `About ${years}` : years;
  return `${kind} · ${age} · ${LIFE_STAGE_LABEL(pet.species, pet.lifeStage)}`;
}

function PetSection({ pet, onEdit }: { pet: PetDTO; onEdit: () => void }) {
  const remove = useDeletePet();
  const { show } = useToast();
  const Icon = pet.species === "DOG" ? Dog : Cat;

  return (
    <section aria-labelledby={`pet-${pet.id}`} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-peach text-orange-ink">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id={`pet-${pet.id}`} className="text-xl font-extrabold text-charcoal">
              {pet.name}
            </h2>
            <p className="text-sm text-muted">{petSummary(pet)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InlineConfirm
            action="Remove"
            prompt={`Remove ${pet.name}?`}
            cancelLabel="Keep"
            pending={remove.isPending}
            onConfirm={() => {
              // A promise, not mutate() callbacks: those are skipped once this section unmounts,
              // which happens as soon as the refreshed list arrives.
              void remove.mutateAsync(pet.id).then(
                () => show({ title: `${pet.name} removed`, icon: "check", duration: 2500 }),
                (err: Error) => show({ title: "Couldn't remove that pet", description: err.message, icon: "alert" }),
              );
            }}
          >
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          </InlineConfirm>
        </div>
      </div>

      {pet.birthdaySoon && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-peach/60 px-4 py-2.5 text-sm font-semibold text-charcoal">
          <Cake className="size-4 shrink-0 text-orange-ink" aria-hidden="true" />
          {pet.name}&apos;s birthday is on {birthdayFormat.format(new Date(`${pet.birthDate}T00:00:00Z`))}. We&apos;ve added a few treat
          ideas.
        </p>
      )}

      <h3 className="mt-6 mb-3 text-lg font-extrabold text-forest">Picked for {pet.name}</h3>
      <PetPicks petId={pet.id} petName={pet.name} />
    </section>
  );
}

/** The "My pets" account tab: each pet, its details and its own product picks. */
export function MyPets() {
  const pets = usePets();
  const { show } = useToast();
  const dialog = useModalTarget<PetDTO | "new">();
  const count = pets.data?.length ?? 0;
  const full = count >= MAX_PETS;

  const addButton = (
    <Button onClick={() => dialog.show("new")} disabled={full}>
      <Plus className="size-5" aria-hidden="true" /> Add a pet
    </Button>
  );

  return (
    <div>
      <PageHeading title="My pets" action={count > 0 ? addButton : undefined}>
        Tell us who you shop for and we&apos;ll pick things that suit their age and needs.
      </PageHeading>
      {full && (
        <p className="mb-4 text-sm text-muted">You&apos;ve added the most we can keep ({MAX_PETS} pets). Remove one to add another.</p>
      )}

      {pets.isPending ? (
        <div className="h-[30rem] skeleton rounded-3xl" />
      ) : pets.isError ? (
        <ErrorState onRetry={() => void pets.refetch()} />
      ) : count === 0 ? (
        <EmptyState icon={<PawPrint className="size-6" aria-hidden="true" />} title="No pets yet" action={addButton}>
          Add your dog or cat and we&apos;ll suggest food, toys and gear for their age, with treat ideas when their birthday comes round.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {pets.data.map((p) => (
            <PetSection key={p.id} pet={p} onEdit={() => dialog.show(p)} />
          ))}
        </div>
      )}

      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "Add a pet" : "Edit pet"}>
        <PetForm
          pet={dialog.target && dialog.target !== "new" ? dialog.target : undefined}
          submitLabel={dialog.target === "new" ? "Add pet" : "Save changes"}
          onSaved={(pet) => {
            show({ title: dialog.target === "new" ? `${pet.name} added` : `${pet.name} updated`, icon: "check", duration: 2500 });
            dialog.close();
          }}
          secondary={
            <Button variant="ghost" onClick={dialog.close}>
              Cancel
            </Button>
          }
        />
      </Modal>
    </div>
  );
}
