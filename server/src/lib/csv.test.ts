import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  const columns = [
    { key: "number", header: "Order" },
    { key: "customer", header: "Customer" },
    { key: "total", header: "Total (₹)" },
  ] as const;

  it("writes a header and CRLF-separated rows", () => {
    expect(toCsv([{ number: "NST-ABC234", customer: "Asha", total: 978 }], columns)).toBe(
      "Order,Customer,Total (₹)\r\nNST-ABC234,Asha,978",
    );
  });

  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv([{ number: "N1", customer: 'Rao, "Asha"\nHyd', total: 1 }], columns);
    expect(csv.split("\r\n")[1]).toBe('N1,"Rao, ""Asha""\nHyd",1');
  });

  it("neutralises spreadsheet formulas in text but keeps negative numbers", () => {
    const csv = toCsv([{ number: "=HYPERLINK(1)", customer: "@cmd", total: -5 }], columns);
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1),'@cmd,-5");
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv([{ number: "N2", customer: null, total: undefined }], columns).split("\r\n")[1]).toBe("N2,,");
  });
});
