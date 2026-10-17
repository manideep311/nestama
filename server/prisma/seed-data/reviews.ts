// Sample reviewers and review copy for the demo catalog. Reviewers are fictional, have no
// login credentials, and every review on a sample product is labelled as sample content in the UI.

export const reviewers = [
  { id: "sample-reviewer-1", name: "Ananya R.", email: "ananya.sample@nestama.test" },
  { id: "sample-reviewer-2", name: "Rohan M.", email: "rohan.sample@nestama.test" },
  { id: "sample-reviewer-3", name: "Priya S.", email: "priya.sample@nestama.test" },
  { id: "sample-reviewer-4", name: "Kabir T.", email: "kabir.sample@nestama.test" },
  { id: "sample-reviewer-5", name: "Meera J.", email: "meera.sample@nestama.test" },
  { id: "sample-reviewer-6", name: "Arjun K.", email: "arjun.sample@nestama.test" },
];

type Pet = "DOG" | "CAT" | "BOTH";

const petWord = (pet: Pet, i: number) =>
  pet === "CAT"
    ? ["Our cat", "My kitten", "Mochi"][i % 3]!
    : pet === "DOG"
      ? ["Our dog", "My pup", "Bruno"][i % 3]!
      : ["Our dog", "Our cat", "Both of ours"][i % 3]!;

/** Deterministic review copy per product: [rating, title, body]. */
export function reviewsFor(productName: string, pet: Pet, category: string, seed: number): [number, string, string][] {
  const who = (i: number) => petWord(pet, seed + i);
  const byCategory: Record<string, [number, string, string][]> = {
    toys: [
      [5, "Instant favourite", `${who(0)} carried it around all evening. Still in one piece after a week of daily play.`],
      [4, "Good quality, fun", `Well made and ${who(1).toLowerCase()} loves it. I'd buy the bigger size next time.`],
      [5, "Worth it", `We've tried cheaper versions — this one actually lasts. ${productName} is now part of our walk kit.`],
    ],
    "food-treats": [
      [5, "Clean bowl every time", `${who(0)} finishes every meal now. Ingredients list is short and easy to read.`],
      [4, "Gentle on the tummy", `Switched slowly over a week and had zero issues. Bag reseals well.`],
      [5, "Great for training", `${who(1)} works for these! Small enough to break up during training sessions.`],
    ],
    "beds-furniture": [
      [5, "Naps all day", `${who(0)} claimed it within minutes. Cover washed beautifully and kept its shape.`],
      [5, "Looks lovely at home", `Sturdy and looks nicer than I expected in the living room.`],
      [4, "Comfy, a little big", `Very comfortable — check the size guide, we could have gone one size smaller.`],
    ],
    grooming: [
      [5, "Bath time is easier", `${who(0)} actually stood still for once. Coat felt soft afterwards.`],
      [4, "Does the job", `Works well on a double coat. Took a couple of sessions to get used to it.`],
      [5, "Less fur on the sofa", `Noticeably less shedding around the house after a week of use.`],
    ],
    "health-wellness": [
      [5, "Happily takes it", `${who(0)} thinks it's a treat. We've seen a difference after a few weeks.`],
      [4, "Easy to give", `No fuss at all. Would love a bigger pack size.`],
      [5, "Vet approved for us", `Our vet was happy with the ingredients. Easy routine to keep up.`],
    ],
    travel: [
      [5, "Road trips sorted", `Made our last trip so much calmer. Sturdy and easy to clean.`],
      [4, "Well designed", `Good ventilation and ${who(0).toLowerCase()} settled in quickly. Straps could be a bit softer.`],
      [5, "Airport approved", `Fit under the seat without trouble. Lots of compliments!`],
    ],
    "collars-leashes": [
      [5, "Perfect fit", `Adjusts easily and feels secure. ${who(0)} doesn't fuss with it at all.`],
      [5, "Strong and comfy", `Survived some serious pulling. Hardware feels premium.`],
      [4, "Nice quality", `Colour is lovely. Sizing runs slightly small, so measure first.`],
    ],
    clothing: [
      [5, "So cute and practical", `${who(0)} stayed warm and dry on our morning walks.`],
      [4, "Good fit", `Fits well, easy to put on. Wash it inside out to keep it nice.`],
      [5, "Compliments everywhere", `Everyone at the park asked where it was from.`],
    ],
    "bowls-feeders": [
      [5, "Heavy and stable", `No more bowl sliding across the kitchen floor.`],
      [4, "Easy to clean", `Dishwasher safe as promised. Looks good too.`],
      [5, "Slowed down mealtimes", `${who(0)} eats much more calmly now.`],
    ],
  };
  const pool = byCategory[category] ?? byCategory.toys!;
  const count = 2 + (seed % 2); // 2–3 reviews per product
  return Array.from({ length: count }, (_, i) => pool[(seed + i) % pool.length]!);
}
