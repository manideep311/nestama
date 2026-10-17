# Pet profiles and recommendations: design

**Date:** 2026-10-15 · **Status:** approved in chat (2026-10-15) · **Builds on:** `2026-10-10-nestama-design.md`

## Goal

Shoppers can tell NESTAMA about their pets and get product picks that fit each one:
- an optional pet step right after sign-up;
- a "My pets" account tab with per-pet recommendations;
- a personalised homepage section.

## Decisions (from the brainstorm)

- **Pet details:** name, dog or cat, birthday.
  - The birthday can be an exact date, or "Not sure?" with an approximate age in years. An approximate age is stored as an *estimated* birth date.
  - Life stage is derived, never entered.
- **Pets per account:** up to 5.
- **Sign-up:** the pet step is optional ("Skip for now").
- **Recommendations:** rule-based scoring on the server, with a short reason per pick.
- **Homepage:** the existing "Recommended for your pet" section is personalised for signed-in shoppers with pets: one tab per pet, defaulting to the first. Everyone else keeps the Dog/Cat tabs.

## Data

New Prisma model `Pet`, table `pets`:

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `userId` | → `User` | `onDelete: Cascade`; indexed |
| `name` | string | 1–40 chars, trimmed |
| `species` | `PetType` | `DOG` or `CAT` only (`BOTH` is a product audience, not a pet) |
| `birthDate` | date | Not in the future and at most 30 years ago |
| `birthDateEstimated` | boolean | True when entered as an approximate age |
| `createdAt`, `updatedAt` | timestamps | |

Life stage comes from `lifeStage(species, birthDate, today)` in `shared`:
- under 1 year: `BABY` (shown as "Puppy" or "Kitten");
- dogs from 7 years and cats from 10: `SENIOR`;
- otherwise `ADULT`.

## API (signed in; a shopper only sees their own pets)

- `GET /api/v1/account/pets` returns `PetDTO[]`, oldest first.
- `POST /api/v1/account/pets` returns `201 PetDTO`, or `409 PET_LIMIT` once the account has 5 pets.
- `PATCH /api/v1/account/pets/:id` returns `PetDTO`.
- `DELETE /api/v1/account/pets/:id` returns `{ deleted: true }`.
- `GET /api/v1/account/pets/:id/recommendations` returns `{ pet: PetDTO, items: { product: ProductCardDTO, reason: string }[] }` (up to 8).
- Another user's pet id returns `404 PET_NOT_FOUND`.

**Input** (`petInputSchema`, strict):
- `name` and `species`;
- plus *either* `birthDate` (`yyyy-mm-dd`) *or* `approxAgeYears` (a whole number, 0–25), never both.

**`PetDTO`:** `{ id, name, species, birthDate, birthDateEstimated, ageYears, lifeStage, birthdaySoon }`.
- `birthdaySoon` is true when an exact (not estimated) birthday falls within the next 30 days.
- Dates are computed in IST.

## Recommendations

`recommendForPet(candidates, pet, limit = 8)` lives in `server/src/lib/recommend.ts`. It's pure and unit tested.

- **Candidates:** active products whose `petType` is the pet's species or `BOTH`, with at least one variant in stock.
- **Score:**
  - popularity: Bayesian-damped rating plus log-scaled sales;
  - plus a bonus when the tags match the life stage (`puppy` or `kitten` for `BABY`, `senior` for `SENIOR`);
  - minus a penalty when they match the *other* stage (no puppy food for a senior dog);
  - plus a bonus for birthday ideas when `birthdaySoon`: products tagged `treats` (not everyday food) and the Toys category.
- **Variety:** at most 2 picks per category, 8 in total.
- **Reasons**, first match wins:
  1. "Birthday treat idea" (tagged `treats`) / "Birthday gift idea" (toys);
  2. "Great for puppies" / "Great for kittens" / "Made for senior dogs" / "Made for senior cats";
  3. "Top rated for dogs" / "Top rated for cats".

## Client

- **Sign-up:** after `signUp.email` succeeds, `RegisterForm` shows a second step, "Tell us about your pet".
  - Fields: a dog/cat choice, name, and a birthday date or "Not sure?" with an approximate age.
  - "Save and continue" creates the pet and goes to `next`; "Skip for now" goes to `next`.
- **My pets** (`/account/pets`, in the account nav after Addresses):
  - One card per pet ("Bruno · Dog · 3 years · Adult") with an "It's Bruno's birthday soon" note when relevant.
  - Edit and remove (an inline "Remove Bruno?" step that focuses "Keep"), plus "Add a pet" (disabled at 5).
  - A "Picked for Bruno" carousel per pet, each card captioned with its reason.
  - The form is shared with sign-up (`PetForm`).
- **Homepage:** `RecommendedForPet` checks the session.
  - With pets, the tabs become the pets' names and the panel loads that pet's picks, titled "Picked for {name}".
  - Without, it behaves as today.
  - The section sits below the fold and keeps its size, so the swap causes no layout shift.

## Errors and edge cases

- Validation messages are inline. The 5-pet limit shows a clear message.
- If recommendations fail to load, the pet card shows "Couldn't load picks" with a retry. The homepage falls back to the Dog/Cat rails.
- Deleting an account deletes its pets (cascade).
- If a pet has no candidates, the carousel is hidden and the card says so.

## Testing

- **shared:** `lifeStage` boundaries; `petInputSchema` (date or age, future date, age range, name length).
- **server unit:** `recommendForPet` stage bonus and penalty, birthday boost, category cap, reasons.
- **server integration:** CRUD, ownership 404, `PET_LIMIT` 409, approximate age stored as estimated, recommendations only for the pet's species, auth required.
- **Browser:** sign-up with a pet and with Skip; My pets add/edit/remove; recommendations; personalised homepage tabs; 375px; keyboard.
