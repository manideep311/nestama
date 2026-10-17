import { describe, it, expect } from "vitest";
import { activeFilters, apiQueryString, hrefWith, toggleListValue } from "./listing-url";

const sp = (s: string) => new URLSearchParams(s);

describe("hrefWith", () => {
  it("sets a value and resets pagination", () => {
    expect(hrefWith("/shop", sp("pet=dog&page=3"), { sort: "price-asc" })).toBe("/shop?pet=dog&sort=price-asc");
  });

  it("removes keys set to null and keeps the page when paging", () => {
    expect(hrefWith("/shop", sp("pet=dog&onSale=1"), { onSale: null })).toBe("/shop?pet=dog");
    expect(hrefWith("/shop", sp("pet=dog"), { page: "2" })).toBe("/shop?pet=dog&page=2");
  });

  it("drops page=1 and default sort for clean URLs", () => {
    expect(hrefWith("/c/toys", sp(""), { page: "1" })).toBe("/c/toys");
    expect(hrefWith("/c/toys", sp("sort=price-asc"), { sort: "featured" })).toBe("/c/toys");
  });
});

describe("toggleListValue", () => {
  it("adds and removes values in a comma list", () => {
    expect(toggleListValue("", "trailtail")).toBe("trailtail");
    expect(toggleListValue("trailtail", "wagwell")).toBe("trailtail,wagwell");
    expect(toggleListValue("trailtail,wagwell", "trailtail")).toBe("wagwell");
    expect(toggleListValue("wagwell", "wagwell")).toBeNull();
  });
});

describe("activeFilters", () => {
  it("describes removable filter chips", () => {
    const chips = activeFilters(sp("pet=cat&brand=wagwell,tug-theory&minPrice=500&rating=4&onSale=1&q=bed"), {
      brandNames: { wagwell: "Wagwell", "tug-theory": "Tug Theory" },
    });
    expect(chips.map((c) => c.label)).toEqual(["Cats", "Wagwell", "Tug Theory", "From ₹500", "4★ & up", "On sale", "“bed”"]);
    expect(chips[1]!.remove).toEqual({ brand: "tug-theory" });
    expect(chips[3]!.remove).toEqual({ minPrice: null });
  });
});

describe("apiQueryString", () => {
  it("keeps only known listing keys and adds fixed ones", () => {
    expect(apiQueryString({ pet: "dog", junk: "x", page: "2" }, { category: "toys" })).toBe("pet=dog&page=2&category=toys");
  });
});
