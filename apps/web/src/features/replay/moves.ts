export function moveLabel(beforeFen: string, san: string | null): string {
  const fields = beforeFen.split(" ");
  return `${fields[5]}${fields[1] === "w" ? ". White" : "... Black"}: ${san}`;
}
