import { z } from "./zod";
import type { ProductCardDTO } from "./catalog";

// Pet profiles: what a shopper tells us about their dog or cat, and the derived facts we use for
// recommendations. Dates are plain `yyyy-mm-dd` strings in India time, so a pet's age never depends
// on the server's or browser's time zone.

export const PET_SPECIES = ["DOG", "CAT"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];
export type LifeStage = "BABY" | "ADULT" | "SENIOR";
export const MAX_PETS = 5;

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const SENIOR_FROM: Record<PetSpecies, number> = { DOG: 7, CAT: 10 };

/** Today's date in India, as `yyyy-mm-dd`. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const toDateString = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = parts(date);
  return toDateString(utc(y, m, d)) === date;
}

/** Whole years between a birth date and today (0 before the first birthday). */
export function ageInYears(birthDate: string, today: string): number {
  const [by, bm, bd] = parts(birthDate);
  const [ty, tm, td] = parts(today);
  const beforeBirthday = tm < bm || (tm === bm && td < bd);
  return Math.max(0, ty - by - (beforeBirthday ? 1 : 0));
}

/** Under one is a puppy or kitten; dogs are senior from 7 and cats from 10. */
export function lifeStage(species: PetSpecies, birthDate: string, today: string): LifeStage {
  const age = ageInYears(birthDate, today);
  if (age < 1) return "BABY";
  return age >= SENIOR_FROM[species] ? "SENIOR" : "ADULT";
}

export function LIFE_STAGE_LABEL(species: PetSpecies, stage: LifeStage): string {
  if (stage === "BABY") return species === "DOG" ? "Puppy" : "Kitten";
  return stage === "SENIOR" ? "Senior" : "Adult";
}

/** True when the next birthday falls between today and `days` days from now. */
export function birthdayWithinDays(birthDate: string, today: string, days = 30): boolean {
  const [, bm, bd] = parts(birthDate);
  const [ty, tm, td] = parts(today);
  const now = utc(ty, tm, td);
  let next = utc(ty, bm, bd);
  if (next < now) next = utc(ty + 1, bm, bd);
  return (next - now) / DAY_MS <= days;
}

/** A stand-in birth date for "about N years old": six months back for under-ones. */
export function estimatedBirthDate(approxAgeYears: number, today: string): string {
  const [y, m, d] = parts(today);
  return approxAgeYears === 0 ? toDateString(utc(y, m - 6, d)) : toDateString(utc(y - approxAgeYears, m, d));
}

export const petInputSchema = z
  .strictObject({
    name: z.string().trim().min(1, "Enter your pet's name").max(40, "Keep the name under 40 characters"),
    species: z.enum(PET_SPECIES, { error: "Choose dog or cat" }),
    birthDate: z.string().optional(),
    approxAgeYears: z
      .number({ error: "Enter an age in years" })
      .int("Use whole years")
      .min(0, "Enter 0 or more")
      .max(25, "Enter 25 or less")
      .optional(),
  })
  .superRefine((v, ctx) => {
    const hasDate = v.birthDate !== undefined && v.birthDate !== "";
    const hasAge = v.approxAgeYears !== undefined;
    if (hasDate && hasAge) {
      ctx.addIssue({ code: "custom", path: ["approxAgeYears"], message: "Give a birthday or an approximate age, not both" });
      return;
    }
    if (!hasDate && !hasAge) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Add a birthday, or tick “Not sure?”" });
      return;
    }
    if (hasDate) {
      const today = istToday();
      if (!isRealDate(v.birthDate!)) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Enter a real date" });
      else if (v.birthDate! > today) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "The birthday can't be in the future" });
      else if (ageInYears(v.birthDate!, today) > 30)
        ctx.addIssue({ code: "custom", path: ["birthDate"], message: "That's older than 30 years" });
    }
  });
export type PetInput = z.input<typeof petInputSchema>;

/** What we store: an approximate age becomes an estimated birth date. */
export interface PetData {
  name: string;
  species: PetSpecies;
  birthDate: string;
  birthDateEstimated: boolean;
}

export function toPetData(input: z.output<typeof petInputSchema>, today: string): PetData {
  const estimated = input.approxAgeYears !== undefined;
  return {
    name: input.name,
    species: input.species,
    birthDate: estimated ? estimatedBirthDate(input.approxAgeYears!, today) : input.birthDate!,
    birthDateEstimated: estimated,
  };
}

export interface PetDTO {
  id: string;
  name: string;
  species: PetSpecies;
  birthDate: string;
  birthDateEstimated: boolean;
  ageYears: number;
  lifeStage: LifeStage;
  /** An exact birthday within the next 30 days (never for estimated dates). */
  birthdaySoon: boolean;
}

export interface PetRecommendationsDTO {
  pet: PetDTO;
  items: { product: ProductCardDTO; reason: string }[];
}
