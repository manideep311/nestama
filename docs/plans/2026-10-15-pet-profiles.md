# Pet Profiles & Recommendations Implementation Plan

**Goal:** Shoppers add their pets (name, dog/cat, birthday or approximate age) at sign-up or in a "My pets" account tab, and get per-pet product picks there and on the homepage.

**Architecture:**
- **Pure logic** lives in `shared/src/pets.ts`: input schema, life stage, age, upcoming birthday, all in IST.
- **Recommendation scoring** is a pure function in `server/src/lib/recommend.ts` over the priced cards from `allProductCards()`.
- **API:** a `pets` module adds CRUD and recommendations under `/api/v1/account/pets` (signed in, ownership enforced).
- **Client:**
  - a TanStack Query hook file;
  - a shared `PetForm` used by sign-up step 2 and the My pets page;
  - the homepage's existing `RecommendedForPet` swaps its Dog/Cat tabs for pet tabs when the shopper has pets.

**Tech Stack:** Prisma 7.10 (new `Pet` model + migration), Express 5, Zod 4, Next.js 16.4, TanStack Query 5, Better Auth session hooks.

**Spec:** `docs/specs/2026-10-15-pet-profiles-design.md` (approved 2026-10-15).

## Global Constraints

- **No git commands.** No deploys.
- Dates are computed in **IST**. A birth date is stored as a `@db.Date`.
- Up to **5 pets** per account (`409 PET_LIMIT`). Someone else's pet returns `404 PET_NOT_FOUND`.
- Input: exactly one of `birthDate` (`yyyy-mm-dd`, not future, at most 30 years ago) or `approxAgeYears` (0–25). Name 1–40 chars, species `DOG`/`CAT`.
- An approximate age is stored as an estimated date: age 0 is 6 months ago, otherwise N years ago. `birthDateEstimated = true`.
- `birthdaySoon` only for exact dates, within the next 30 days.
- Recommendations: in-stock items for the species or `BOTH`; at most 2 per category; 8 total; each with a `reason`.
- The homepage swap must not shift layout. It sits below the fold, in the same section box.
- Every new screen gets loading, empty and error states, works at 375px, and is keyboard reachable. The OpenAPI registry is updated (the sync test enforces it).

---

### Task 1: Shared pet contracts
**Files:** create `shared/src/pets.ts`, `shared/src/pets.test.ts`; modify `shared/src/index.ts`.

**Produces:**
- `PET_SPECIES = ["DOG","CAT"] as const`, `type PetSpecies`, `type LifeStage = "BABY" | "ADULT" | "SENIOR"`.
- `istToday(now?: Date): string` (`yyyy-mm-dd` in IST).
- `ageInYears(birthDate: string, today: string): number`.
- `lifeStage(species, birthDate, today): LifeStage`: under 1 year is `BABY`; a dog ≥ 7 or cat ≥ 10 is `SENIOR`.
- `birthdayWithinDays(birthDate, today, days = 30): boolean` (from today through `days` days ahead).
- `estimatedBirthDate(approxAgeYears, today): string`.
- `LIFE_STAGE_LABEL(species, stage)`: "Puppy", "Kitten", "Adult" or "Senior".
- `petInputSchema` (strict). `type PetInput` (the input) and `type PetData = { name; species; birthDate: string; birthDateEstimated: boolean }` (normalised by `toPetData(input, today)`).
- `PetDTO { id, name, species, birthDate, birthDateEstimated, ageYears, lifeStage, birthdaySoon }`.
- `PetRecommendationsDTO { pet: PetDTO; items: { product: ProductCardDTO; reason: string }[] }`.
- `MAX_PETS = 5`.
- [x] Tests: life-stage boundaries for dogs and cats; age before and after this year's birthday; birthday window across a year end; estimated date for 0 and 3; schema rejects both or neither, future dates, ages over 25, names over 40.

### Task 2: Database
**Files:** modify `server/prisma/schema.prisma` (`model Pet`, `User.pets`); new migration `pets` via `prisma migrate dev` against the local DB.
- [x] The migration applies, `prisma generate` succeeds, and the server typechecks.

### Task 3: Recommendation scoring
**Files:** create `server/src/lib/recommend.ts` and `recommend.test.ts`.

**Produces:** `recommendForPet(candidates: Candidate[], pet: { species; lifeStage; birthdaySoon }, limit = 8): { id: string; reason: string }[]`, where `Candidate = { id; petType; tags: string[]; categoryKey: string; ratingAvg; ratingCount; soldCount; inStock: boolean }`.
- **Score:**
  - `bayes = (ratingAvg*ratingCount + 4*20) / (ratingCount + 20)`, plus `0.35*log10(1+soldCount)`;
  - life-stage tag match +1.5 (`puppy`/`kitten` for `BABY`, `senior` for `SENIOR`);
  - opposite-stage tag −3;
  - birthday +1 for `categoryKey` in `food-treats` or `toys`.
- **Selection:** sort by score (then id, for stability), cap 2 per `categoryKey`, take `limit`.
- **Reason**, first match:
  1. birthday and a treats/toys category: "Birthday treat idea";
  2. stage match: "Great for puppies" / "Great for kittens" / "Made for senior dogs" / "Made for senior cats";
  3. otherwise "Top rated for dogs" / "Top rated for cats".
- [x] Tests: the species filter, stage bonus and penalty ordering, the birthday boost and its reason, the category cap, out-of-stock excluded, a deterministic order.

### Task 4: Pets API
**Files:**
- create `server/src/modules/pets/{pets.service.ts,pets.routes.ts}`;
- mount in `server/src/app.ts`;
- add routes to `server/src/docs/openapi.ts`;
- create `server/test/pets.int.test.ts`.

**Produces:**
- `listPets(userId)`, `createPet(userId, PetData)`, `updatePet(userId, id, PetData)`, `deletePet(userId, id)`, `getPetRecommendations(userId, id, now)`.
- Routes per the spec. Validation uses `petInputSchema`, then `toPetData(input, istToday())`.
- [x] Integration tests (written first):
  - anonymous gets 401;
  - create with a date and with an approximate age (estimated);
  - list is oldest first;
  - update and delete;
  - another user's pet gets 404;
  - a 6th pet gets 409;
  - recommendations are only the species or `BOTH`, at most 8, each with a reason, and a different user gets 404.

### Task 5: Client: sign-up step, My pets tab
**Files:**
- create `client/src/lib/pets-client.ts`, `client/src/components/pets/{PetForm,PetPicks,MyPets}.tsx`, `client/src/app/(store)/account/pets/page.tsx`;
- modify `client/src/components/auth/AuthForms.tsx` (step 2) and `client/src/components/account/AccountShell.tsx` (nav item).

**Produces:**
- `usePets()`, `usePetRecommendations(petId)`, `useSavePet()`, `useDeletePet()`.
- `PetForm({ pet?, submitLabel, onSaved, onCancel?, secondaryAction? })`, used by both sign-up and My pets.
- `PetPicks({ petId, petName })`: a carousel with reason captions plus loading, empty and error states.
- [x] In the browser: register with a pet; register with Skip; add, edit and remove on My pets (the 5-pet limit message); picks render; 375px; keyboard.

### Task 6: Homepage personalisation
**Files:** modify `client/src/components/home/RecommendedForPet.tsx`.
- With a session and pets, the tabs are pet names (with arrow-key tabs as today), titled "Picked for {name}", and the panel shows `PetPicks`. Otherwise it behaves as today.
- [x] Verify: guest sees Dog/Cat; a signed-in shopper with pets sees their tabs; no CLS (measured); the API failing falls back to Dog/Cat.

### Task 7: Verification
- [x] All tests, typecheck, lint, Prettier and both builds. Then clean up test users and pets. Then the report.

---

## Completion notes (2026-10-15)

All seven tasks are done and verified. Departures from the plan, and what verification found:

- **Birthday picks (Task 3):** the +1 boost goes to products tagged `treats` and to the Toys category, not the whole `food-treats` category; everyday food was showing up as a "birthday treat". Toys get their own reason, "Birthday gift idea". The spec is updated to match.
- **PetForm (Task 5):** the props ended up as `{ pet?, submitLabel, onSaved, secondary? }`. A client pre-check flags a missing birthday or age along with the other fields, because the schema's `superRefine` doesn't run while name or species are invalid.
- **Remove and delete confirmation:** the new `client/src/components/ui/InlineConfirm.tsx` now serves both My pets and Addresses.
  - **Accidental confirm:** React reused the button just pressed as the confirm button, so a double click or a second Enter removed the item. The confirm row is now always new elements, and focus moves to the safe "Keep" (and back).
  - **Missing toasts:** the success toasts never fired, because `mutate()` callbacks are skipped once the card unmounts. They now use `mutateAsync().then(...)`.
- **ProductCarousel:** reason chips sit under each card in a column layout; they were clipped while the card was `h-full`.
- **Homepage swap:** the personal rail is 32px taller per row because of the reason chips.
  - The section starts about 4,770px down a 812px phone viewport, so the swap can't move anything visible at load.
  - Within the 5-minute picks cache, a return visit renders the personal rail directly.
  - This was measured as geometry (section position and height), not with a layout-shift observer.
  - "The API fails → Dog/Cat" follows from the render condition (no picks data means the Dog/Cat rail). It was not forced in the browser.
- **Verified in the browser** (375px and desktop):
  - register with a pet, and with Skip;
  - add, edit and remove;
  - the 5-pet limit: the server returns 409, "Add a pet" is disabled and the message shows;
  - senior, kitten and birthday reasons;
  - homepage tabs for 1, 2 and 5 pets (five wrap onto two rows inside 375px);
  - a keyboard pass: species radios with the arrow keys, Space toggles "Not sure?", Escape closes the dialog and focus returns to "Add a pet".
- **Checks:** shared 43, client 56 and server 178 tests pass. Typecheck, lint and Prettier are clean, and both builds pass (127 static pages).
- **Cleanup:** all QA users and their pets are deleted from the local DB, along with the Lighthouse cookie files in `%TEMP%`.
