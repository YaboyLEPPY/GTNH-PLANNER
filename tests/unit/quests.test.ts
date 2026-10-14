import { it, expect } from "vitest";
import { questStatus } from "../../src/domain/quests";
import { minecraftText } from "../../src/domain/formatting";
import { decodeEntities } from "../../src/data";
it("honors source AND, OR and XOR quest prerequisite logic", () => {
  expect(questStatus("a", ["b", "c"], "AND", ["b"])).toBe("locked");
  expect(questStatus("a", ["b", "c"], "OR", ["b"])).toBe("available");
  expect(questStatus("a", ["b", "c"], "XOR", ["b", "c"])).toBe("locked");
  expect(questStatus("a", [], "AND", [])).toBe("available");
  expect(questStatus("a", ["b"], "AND", ["a"])).toBe("completed");
});
it("retains Minecraft emphasis without interpreting HTML and resolves encoded names", () => {
  expect(
    minecraftText("plain §lbold§r plain").map((r) => [r.text, r.bold]),
  ).toEqual([
    ["plain ", false],
    ["bold", true],
    [" plain", false],
  ]);
  expect(decodeEntities("Coin &quot;The Chemist 1&quot;")).toBe(
    'Coin "The Chemist 1"',
  );
  expect(decodeEntities("&#x26;")).toBe("&");
});
