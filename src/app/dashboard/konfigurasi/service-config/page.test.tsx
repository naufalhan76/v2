import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("ServiceConfigPage", () => {
  it("does not override active tab text to text-foreground", () => {
    const pagePath = join(__dirname, "page.tsx");
    const pageContent = readFileSync(pagePath, "utf-8");
    
    expect(pageContent).not.toContain("data-[state=active]:text-foreground");
  });

  it("keeps non-default service config tab bundles lazy-loaded", () => {
    const pagePath = join(__dirname, "page.tsx");
    const pageContent = readFileSync(pagePath, "utf-8");

    expect(pageContent).not.toContain("import { UnitTypeTab }");
    expect(pageContent).not.toContain("import { CapacityTab }");
    expect(pageContent).not.toContain("import { BrandTab }");
    expect(pageContent).not.toContain("import { ServiceTypeTab }");
    expect(pageContent).toContain("dynamic(() => import('./components/UnitTypeTab').then");
    expect(pageContent).toContain("dynamic(() => import('./components/CapacityTab').then");
    expect(pageContent).toContain("dynamic(() => import('./components/BrandTab').then");
    expect(pageContent).toContain("dynamic(() => import('./components/ServiceTypeTab').then");
  });
});
