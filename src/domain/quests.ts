export function questStatus(
  id: string,
  prerequisites: string[],
  logic: string,
  done: string[],
) {
  if (done.includes(id)) return "completed";
  if (prerequisites.length === 0) return "available";
  const n = prerequisites.filter((p) => done.includes(p)).length;
  const available =
    logic === "OR"
      ? n > 0
      : logic === "XOR"
        ? n === 1
        : logic === "NAND"
          ? n < prerequisites.length
          : logic === "NOR"
            ? n === 0
            : logic === "XNOR"
              ? n !== 1
              : n === prerequisites.length;
  return available ? "available" : "locked";
}
