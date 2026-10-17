import type { LifeStage, PetSpecies } from "@nestama/shared";

/** What the scorer needs to know about a product (built from the priced catalogue). */
export interface Candidate {
  id: string;
  petType: "DOG" | "CAT" | "BOTH";
  tags: string[];
  /** Top-level category slug, used for variety and birthday ideas. */
  categoryKey: string;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  inStock: boolean;
}

export interface PetProfile {
  species: PetSpecies;
  lifeStage: LifeStage;
  birthdaySoon: boolean;
}

/** What makes a good birthday pick: actual treats (not everyday food) and toys. */
function birthdayIdea(c: Candidate): "treat" | "gift" | null {
  if (c.tags.includes("treats")) return "treat";
  return c.categoryKey === "toys" ? "gift" : null;
}
const PER_CATEGORY = 2;
// Ratings are pulled towards 4★ until a product has a couple of dozen reviews.
const PRIOR_RATING = 4;
const PRIOR_WEIGHT = 20;

const babyTag = (species: PetSpecies) => (species === "DOG" ? "puppy" : "kitten");

function stageFit(c: Candidate, pet: PetProfile): number {
  const baby = c.tags.includes("puppy") || c.tags.includes("kitten");
  const senior = c.tags.includes("senior");
  if (pet.lifeStage === "BABY") return (c.tags.includes(babyTag(pet.species)) ? 1.5 : 0) - (senior ? 3 : 0);
  if (pet.lifeStage === "SENIOR") return (senior ? 1.5 : 0) - (baby ? 3 : 0);
  // Adults: stage-specific items are a weaker fit, not wrong.
  return baby || senior ? -1 : 0;
}

function score(c: Candidate, pet: PetProfile): number {
  const rating = (c.ratingAvg * c.ratingCount + PRIOR_RATING * PRIOR_WEIGHT) / (c.ratingCount + PRIOR_WEIGHT);
  const popularity = 0.35 * Math.log10(1 + c.soldCount);
  const birthday = pet.birthdaySoon && birthdayIdea(c) ? 1 : 0;
  return rating + popularity + stageFit(c, pet) + birthday;
}

function reason(c: Candidate, pet: PetProfile): string {
  const idea = pet.birthdaySoon ? birthdayIdea(c) : null;
  if (idea) return idea === "treat" ? "Birthday treat idea" : "Birthday gift idea";
  if (pet.lifeStage === "BABY" && c.tags.includes(babyTag(pet.species)))
    return pet.species === "DOG" ? "Great for puppies" : "Great for kittens";
  if (pet.lifeStage === "SENIOR" && c.tags.includes("senior"))
    return pet.species === "DOG" ? "Made for senior dogs" : "Made for senior cats";
  return pet.species === "DOG" ? "Top rated for dogs" : "Top rated for cats";
}

/**
 * Picks for one pet: in-stock products for its species (or both), ranked by rating, popularity and
 * life-stage fit, at most two per category so the row stays varied. Pure, so it is unit tested.
 */
export function recommendForPet(candidates: Candidate[], pet: PetProfile, limit = 8): { id: string; reason: string }[] {
  const ranked = candidates
    .filter((c) => c.inStock && (c.petType === pet.species || c.petType === "BOTH"))
    .map((c) => ({ c, s: score(c, pet) }))
    .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id));

  const perCategory = new Map<string, number>();
  const picks: { id: string; reason: string }[] = [];
  for (const { c } of ranked) {
    const used = perCategory.get(c.categoryKey) ?? 0;
    if (used >= PER_CATEGORY) continue;
    perCategory.set(c.categoryKey, used + 1);
    picks.push({ id: c.id, reason: reason(c, pet) });
    if (picks.length === limit) break;
  }
  return picks;
}
