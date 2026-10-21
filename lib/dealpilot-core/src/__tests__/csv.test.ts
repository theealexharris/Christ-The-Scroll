import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, mapCsvToProperties, parseCsv } from "../csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
    ]);
  });
  it("skips blank lines and strips a BOM", () => {
    expect(parseCsv("﻿a\n\n1\n")).toEqual([["a"], ["1"]]);
  });
  it("supports newlines inside quoted fields", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });
});

describe("mapCsvToProperties", () => {
  it("parses the template", () => {
    const r = mapCsvToProperties(CSV_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].data).toMatchObject({ title: "My lead", city: "Springfield", listPrice: 150000, estimatedRentMonthly: 1500, category: "on_market" });
  });
  it("reports row-level errors with spreadsheet row numbers", () => {
    const csv = "address,city,state,price,category\n1 A St,Town,OH,$120,000,on_market\n2 B St,Town,OH,abc,on_market\n3 C St,,OH,1000,nonsense\n";
    const r = mapCsvToProperties(csv);
    expect(r.valid).toHaveLength(0);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4]);
    expect(r.errors[1].messages.join(" ")).toMatch(/not a number/);
    expect(r.errors[2].messages.join(" ")).toMatch(/unknown category/);
  });
  it("accepts category labels, currency formatting and defaults title to address", () => {
    const r = mapCsvToProperties('address,city,state,price,category,type\n9 Elm St,Town,OH,"$95,000",Foreclosures,Single-family\n');
    expect(r.errors).toEqual([]);
    expect(r.valid[0].data).toMatchObject({ title: "9 Elm St", listPrice: 95000, category: "foreclosure", propertyType: "single_family" });
  });
  it("lists unknown headers and rejects empty files", () => {
    expect(mapCsvToProperties("address,city,state,mystery\n1 A,B,OH,x\n").unknownHeaders).toEqual(["mystery"]);
    expect(mapCsvToProperties("address\n").errors[0].messages[0]).toMatch(/header row/);
  });
});
