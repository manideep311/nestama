import {
  ageInYears,
  birthdayWithinDays,
  istToday,
  lifeStage,
  MAX_PETS,
  type PetData,
  type PetDTO,
  type PetRecommendationsDTO,
  type PetSpecies,
} from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recommendForPet, type Candidate } from "../../lib/recommend";
import { allProductCards } from "../catalog/catalog.service";

interface PetRow {
  id: string;
  name: string;
  species: "DOG" | "CAT" | "BOTH";
  birthDate: Date;
  birthDateEstimated: boolean;
}

// `@db.Date` columns come back as UTC midnight, so the ISO date is the stored calendar date.
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const toDb = (d: PetData) => ({ ...d, birthDate: new Date(`${d.birthDate}T00:00:00Z`) });

export function toPetDTO(p: PetRow, today = istToday()): PetDTO {
  const species = p.species as PetSpecies;
  const birthDate = dateOnly(p.birthDate);
  return {
    id: p.id,
    name: p.name,
    species,
    birthDate,
    birthDateEstimated: p.birthDateEstimated,
    ageYears: ageInYears(birthDate, today),
    lifeStage: lifeStage(species, birthDate, today),
    // A guessed birthday shouldn't trigger birthday wishes.
    birthdaySoon: !p.birthDateEstimated && birthdayWithinDays(birthDate, today),
  };
}

async function ownPet(userId: string, id: string): Promise<PetRow> {
  const pet = await prisma.pet.findFirst({ where: { id, userId } });
  if (!pet) throw new AppError("PET_NOT_FOUND", 404, "We couldn't find that pet.");
  return pet;
}

export async function listPets(userId: string): Promise<PetDTO[]> {
  const pets = await prisma.pet.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const today = istToday();
  return pets.map((p) => toPetDTO(p, today));
}

export async function createPet(userId: string, data: PetData): Promise<PetDTO> {
  const pet = await prisma.$transaction(async (tx) => {
    if ((await tx.pet.count({ where: { userId } })) >= MAX_PETS) {
      throw new AppError("PET_LIMIT", 409, `You can save up to ${MAX_PETS} pets. Remove one to add another.`);
    }
    return tx.pet.create({ data: { userId, ...toDb(data) } });
  });
  return toPetDTO(pet);
}

export async function updatePet(userId: string, id: string, data: PetData): Promise<PetDTO> {
  await ownPet(userId, id);
  return toPetDTO(await prisma.pet.update({ where: { id }, data: toDb(data) }));
}

export async function deletePet(userId: string, id: string): Promise<{ deleted: true }> {
  const { count } = await prisma.pet.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError("PET_NOT_FOUND", 404, "We couldn't find that pet.");
  return { deleted: true };
}

/** Up to eight priced product cards picked for this pet, each with a short reason. */
export async function getPetRecommendations(userId: string, id: string, now = new Date()): Promise<PetRecommendationsDTO> {
  const pet = toPetDTO(await ownPet(userId, id), istToday(now));
  const { cards, rows } = await allProductCards(now);
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const candidates: Candidate[] = cards.map((card) => {
    const row = rowById.get(card.id)!;
    return {
      id: card.id,
      petType: card.petType,
      tags: row.tags,
      categoryKey: row.category.parent?.slug ?? row.category.slug,
      ratingAvg: card.ratingAvg,
      ratingCount: card.ratingCount,
      soldCount: row.soldCount,
      inStock: card.stock !== "OUT_OF_STOCK",
    };
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const picks = recommendForPet(candidates, { species: pet.species, lifeStage: pet.lifeStage, birthdaySoon: pet.birthdaySoon });
  return { pet, items: picks.map((p) => ({ product: cardById.get(p.id)!, reason: p.reason })) };
}
