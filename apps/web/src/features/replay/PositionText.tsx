import { fenStringToPositionObject } from "react-chessboard";

const pieceNames: Record<string, string> = {
  P: "pawn",
  N: "knight",
  B: "bishop",
  R: "rook",
  Q: "queen",
  K: "king",
};

export function PositionText({ fen }: { fen: string }) {
  const pieces = fenStringToPositionObject(fen, 8, 8);
  return (
    <details className="position-text">
      <summary>Text position and FEN</summary>
      <p>Occupied squares are listed below; all other squares are empty.</p>
      <table>
        <caption>Position pieces</caption>
        <thead>
          <tr>
            <th scope="col">Square</th>
            <th scope="col">Piece</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(pieces).map(([square, { pieceType }]) => (
            <tr key={square}>
              <th scope="row">{square}</th>
              <td>
                {pieceType[0] === "w" ? "White" : "Black"}{" "}
                {pieceNames[pieceType.slice(1)]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-label="Position FEN" className="fen">
        {fen}
      </p>
    </details>
  );
}
