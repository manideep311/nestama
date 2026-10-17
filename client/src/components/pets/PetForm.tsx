"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Cat, Dog, Loader2 } from "lucide-react";
import { firstFieldErrors, istToday, petInputSchema, type PetDTO, type PetInput, type PetSpecies } from "@nestama/shared";
import { useSavePet } from "@/lib/pets-client";
import { ApiRequestError } from "@/lib/cart-client";
import { Button } from "@/components/ui/Button";
import { FormAlert, TextField } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const SPECIES: { value: PetSpecies; label: string; Icon: typeof Dog }[] = [
  { value: "DOG", label: "Dog", Icon: Dog },
  { value: "CAT", label: "Cat", Icon: Cat },
];

/** Add or edit a pet: dog or cat, name, and a birthday or an approximate age. Used at sign-up and in My pets. */
export function PetForm({
  pet,
  submitLabel,
  onSaved,
  secondary,
}: {
  pet?: PetDTO;
  submitLabel: string;
  onSaved: (pet: PetDTO) => void;
  /** e.g. "Skip for now" at sign-up, "Cancel" in a dialog. */
  secondary?: ReactNode;
}) {
  const save = useSavePet();
  const id = useId();
  const today = istToday();
  const oldest = `${Number(today.slice(0, 4)) - 30}${today.slice(4)}`;
  const [species, setSpecies] = useState<PetSpecies | null>(pet?.species ?? null);
  const [name, setName] = useState(pet?.name ?? "");
  const [notSure, setNotSure] = useState(pet?.birthDateEstimated ?? false);
  const [birthDate, setBirthDate] = useState(pet && !pet.birthDateEstimated ? pet.birthDate : "");
  const [age, setAge] = useState(pet?.birthDateEstimated ? String(pet.ageYears) : "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = {
      name,
      species: species ?? undefined,
      ...(notSure ? { approxAgeYears: age.trim() === "" ? undefined : Number(age) } : { birthDate: birthDate || undefined }),
    };
    const parsed = petInputSchema.safeParse(input);
    const found = parsed.success ? {} : firstFieldErrors(parsed.error);
    // The schema only checks the date/age pair once name and species pass, so missing ones are
    // flagged here too: every problem shows on the first try. A missing age goes on the age field.
    if (notSure && age.trim() === "") found.approxAgeYears = "Enter an approximate age in years";
    if (!notSure && !birthDate) found.birthDate ??= "Add a birthday, or tick “Not sure?”";
    if (notSure) delete found.birthDate;
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    save.mutate({ id: pet?.id, data: input as PetInput }, { onSuccess: onSaved });
  }

  const clear = (field: string) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {save.isError && (
        <FormAlert>{save.error instanceof ApiRequestError ? save.error.message : "We couldn't save your pet. Please try again."}</FormAlert>
      )}

      <fieldset aria-describedby={errors.species ? `${id}-species-error` : undefined}>
        <legend className="mb-2 text-sm font-bold text-forest">Your pet is a…</legend>
        <div className="grid grid-cols-2 gap-3">
          {SPECIES.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={cn(
                "relative flex h-16 cursor-pointer items-center justify-center gap-2.5 rounded-2xl text-base font-extrabold ring-2 transition-colors",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest",
                species === value ? "bg-forest text-cream ring-forest" : "bg-white text-forest ring-line hover:bg-sage",
              )}
            >
              <input
                type="radio"
                name={`${id}-species`}
                value={value}
                checked={species === value}
                onChange={() => {
                  setSpecies(value);
                  clear("species");
                }}
                className="sr-only"
              />
              <Icon className="size-6" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
        {errors.species && (
          <p id={`${id}-species-error`} className="mt-1.5 text-sm font-semibold text-orange-ink">
            {errors.species}
          </p>
        )}
      </fieldset>

      <TextField
        label="Name"
        value={name}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => {
          setName(e.target.value);
          clear("name");
        }}
        error={errors.name}
        placeholder="e.g. Bruno"
      />

      {notSure ? (
        <TextField
          label="Approximate age (years)"
          type="number"
          inputMode="numeric"
          min={0}
          max={25}
          step={1}
          value={age}
          onChange={(e) => {
            setAge(e.target.value);
            clear("approxAgeYears");
          }}
          error={errors.approxAgeYears}
          hint="Under a year old? Enter 0."
        />
      ) : (
        <TextField
          label="Birthday"
          type="date"
          min={oldest}
          max={today}
          value={birthDate}
          onChange={(e) => {
            setBirthDate(e.target.value);
            clear("birthDate");
          }}
          error={errors.birthDate}
        />
      )}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-charcoal">
        <input
          type="checkbox"
          checked={notSure}
          onChange={(e) => {
            setNotSure(e.target.checked);
            setErrors((x) => ({ ...x, birthDate: undefined, approxAgeYears: undefined }));
          }}
          className="size-4 accent-forest"
        />
        Not sure of the birthday? Enter an approximate age instead.
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={save.isPending} aria-busy={save.isPending || undefined}>
          {save.isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
        {secondary}
      </div>
    </form>
  );
}
