import { describe, expect, it } from "vitest";
import {
  ageInYears,
  birthdayWithinDays,
  estimatedBirthDate,
  istToday,
  LIFE_STAGE_LABEL,
  lifeStage,
  petInputSchema,
  toPetData,
} from "./pets";

describe("istToday", () => {
  it("uses the India date, not UTC", () => {
    // 20:00 UTC on 14 Oct is 01:30 on 15 Oct in India.
    expect(istToday(new Date("2026-10-14T20:00:00Z"))).toBe("2026-10-15");
    expect(istToday(new Date("2026-10-14T10:00:00Z"))).toBe("2026-10-14");
  });
});

describe("ageInYears", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageInYears("2023-10-15", "2026-10-14")).toBe(2);
    expect(ageInYears("2023-10-15", "2026-10-15")).toBe(3);
    expect(ageInYears("2026-05-01", "2026-10-15")).toBe(0);
  });
});

describe("lifeStage", () => {
  it("calls pets under one a baby", () => {
    expect(lifeStage("DOG", "2026-01-01", "2026-10-15")).toBe("BABY");
    expect(lifeStage("CAT", "2025-10-16", "2026-10-15")).toBe("BABY");
  });

  it("makes dogs senior at 7 and cats at 10", () => {
    expect(lifeStage("DOG", "2019-10-16", "2026-10-15")).toBe("ADULT");
    expect(lifeStage("DOG", "2019-10-15", "2026-10-15")).toBe("SENIOR");
    expect(lifeStage("CAT", "2019-10-15", "2026-10-15")).toBe("ADULT");
    expect(lifeStage("CAT", "2016-10-15", "2026-10-15")).toBe("SENIOR");
  });

  it("has species-aware labels", () => {
    expect(LIFE_STAGE_LABEL("DOG", "BABY")).toBe("Puppy");
    expect(LIFE_STAGE_LABEL("CAT", "BABY")).toBe("Kitten");
    expect(LIFE_STAGE_LABEL("CAT", "SENIOR")).toBe("Senior");
  });
});

describe("birthdayWithinDays", () => {
  it("looks ahead from today, including today", () => {
    expect(birthdayWithinDays("2022-10-15", "2026-10-15")).toBe(true);
    expect(birthdayWithinDays("2022-11-14", "2026-10-15")).toBe(true);
    expect(birthdayWithinDays("2022-11-15", "2026-10-15")).toBe(false);
    expect(birthdayWithinDays("2022-10-14", "2026-10-15")).toBe(false);
  });

  it("wraps across the new year", () => {
    expect(birthdayWithinDays("2020-01-05", "2026-12-20")).toBe(true);
  });
});

describe("estimatedBirthDate", () => {
  it("places under-ones six months back and others whole years back", () => {
    expect(estimatedBirthDate(0, "2026-10-15")).toBe("2026-04-15");
    expect(estimatedBirthDate(3, "2026-10-15")).toBe("2023-10-15");
  });
});

describe("petInputSchema", () => {
  const today = istToday();
  const base = { name: "Bruno", species: "DOG" as const };

  it("accepts a birth date or an approximate age, not both or neither", () => {
    expect(petInputSchema.safeParse({ ...base, birthDate: "2023-04-02" }).success).toBe(true);
    expect(petInputSchema.safeParse({ ...base, approxAgeYears: 3 }).success).toBe(true);
    expect(petInputSchema.safeParse({ ...base, birthDate: "2023-04-02", approxAgeYears: 3 }).success).toBe(false);
    expect(petInputSchema.safeParse(base).success).toBe(false);
  });

  it("rejects future dates, very old dates, big ages and long names", () => {
    const year = Number(today.slice(0, 4));
    expect(petInputSchema.safeParse({ ...base, birthDate: `${year + 1}-01-01` }).success).toBe(false);
    expect(petInputSchema.safeParse({ ...base, birthDate: `${year - 31}-01-01` }).success).toBe(false);
    expect(petInputSchema.safeParse({ ...base, birthDate: "2023-02-30" }).success).toBe(false);
    expect(petInputSchema.safeParse({ ...base, approxAgeYears: 26 }).success).toBe(false);
    expect(petInputSchema.safeParse({ ...base, name: "x".repeat(41), approxAgeYears: 2 }).success).toBe(false);
    expect(petInputSchema.safeParse({ ...base, name: "  ", approxAgeYears: 2 }).success).toBe(false);
  });

  it("rejects unknown fields and the BOTH audience", () => {
    expect(petInputSchema.safeParse({ ...base, approxAgeYears: 2, extra: 1 }).success).toBe(false);
    expect(petInputSchema.safeParse({ name: "Bo", species: "BOTH", approxAgeYears: 2 }).success).toBe(false);
  });

  it("normalises input into stored data", () => {
    expect(toPetData(petInputSchema.parse({ name: " Misty ", species: "CAT", approxAgeYears: 3 }), "2026-10-15")).toEqual({
      name: "Misty",
      species: "CAT",
      birthDate: "2023-10-15",
      birthDateEstimated: true,
    });
    expect(toPetData(petInputSchema.parse({ ...base, birthDate: "2023-04-02" }), "2026-10-15")).toEqual({
      name: "Bruno",
      species: "DOG",
      birthDate: "2023-04-02",
      birthDateEstimated: false,
    });
  });
});
