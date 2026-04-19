import { expect, test } from "@playwright/test";

test("dispatcher can move from Reports into the Map assignment workflow", async ({ page }) => {
  await page.goto("/reports");

  await expect(page.getByRole("heading", { name: "Trucky's smart to-do board" })).toBeVisible();

  await page.getByRole("button", { name: "Assign Patel" }).click();

  await expect(page).toHaveURL(/dispatchLoad=LD-4812/);
  await expect(page.getByText("Dispatch mode")).toBeVisible();
  await expect(page.getByText("LD-4812 • Dallas -> Houston")).toBeVisible();

  const assignButton = page.getByRole("button", { name: /Assign this driver|Assign suggested driver/ }).first();
  await expect(assignButton).toBeVisible({ timeout: 20_000 });
  await assignButton.click();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Load board" })).toBeVisible();
});
