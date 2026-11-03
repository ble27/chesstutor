// Validate display syntax only; legal chess positions/moves remain server-owned.
export function positionFen(value: string): string {
  const fields = value.split(" ");
  const ranks = fields[0]?.split("/") ?? [];
  const validRanks =
    ranks.length === 8 &&
    ranks.every((rank) => {
      if (!/^[prnbqkPRNBQK1-8]+$/.test(rank)) return false;
      return (
        [...rank].reduce(
          (width, symbol) =>
            width + (/^[1-8]$/.test(symbol) ? Number(symbol) : 1),
          0,
        ) === 8
      );
    });
  if (
    fields.length !== 6 ||
    !validRanks ||
    !/^[wb]$/.test(fields[1] ?? "") ||
    !/^(?:-|KQ?k?q?|Qk?q?|kq?|q)$/.test(fields[2] ?? "") ||
    !/^(?:-|[a-h][36])$/.test(fields[3] ?? "") ||
    !/^(?:0|[1-9]\d*)$/.test(fields[4] ?? "") ||
    !/^[1-9]\d*$/.test(fields[5] ?? "") ||
    !Number.isSafeInteger(Number(fields[4])) ||
    !Number.isSafeInteger(Number(fields[5]))
  )
    throw new Error("Invalid position FEN");
  return value;
}

export function validateMove(
  ply: number,
  san: string | null,
  uci: string | null,
): void {
  if (ply === 0) {
    if (san !== null || uci !== null) throw new Error("Invalid initial move");
  } else if (
    !san ||
    san.length > 32 ||
    !uci ||
    !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)
  ) {
    throw new Error("Invalid move notation");
  }
}
