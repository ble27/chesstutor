import { useState } from "react";
import type { Sandbox } from "./useSandbox";
export function SandboxPanel({ sandbox }: { sandbox: Sandbox }) {
  const [move, setMove] = useState("");
  return (
    <section className="sandbox-panel" aria-label="Free analysis controls">
      <p role="status">
        Free analysis · recorded root ply {sandbox.root} · branch{" "}
        {sandbox.branch.length}/100 plies. Recorded coaching and accuracy stay
        unchanged.
      </p>
      {sandbox.busy && <p role="status">Validating position…</p>}
      {sandbox.error && <p role="alert">{sandbox.error}</p>}
      {sandbox.position?.result && <p>Result: {sandbox.position.result}</p>}
      {sandbox.position?.claimable_draw && (
        <p>A draw is claimable with this history.</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sandbox.play(move);
          setMove("");
        }}
      >
        <label>
          Legal move
          <select
            value={move}
            onChange={(event) => setMove(event.target.value)}
            disabled={sandbox.busy}
          >
            <option value="">Choose a move</option>
            {sandbox.position?.legal_moves.map((uci) => (
              <option value={uci} key={uci}>
                {uci.slice(0, 2)} to {uci.slice(2, 4)}
                {uci.length === 5
                  ? `, promote to ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[uci[4] ?? ""] ?? "piece"}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!move || sandbox.busy || sandbox.branch.length >= 100}
        >
          Play move
        </button>
      </form>
      <button
        onClick={sandbox.undo}
        disabled={sandbox.busy || sandbox.branch.length === 0}
      >
        Undo branch move
      </button>
      <button
        onClick={sandbox.redo}
        disabled={sandbox.busy || sandbox.future.length === 0}
      >
        Redo branch move
      </button>
      {sandbox.saved.length > 0 && (
        <label>
          Saved branches
          <select
            defaultValue=""
            onChange={(event) => sandbox.choose(Number(event.target.value))}
          >
            <option value="" disabled>
              Choose a branch
            </option>
            {sandbox.saved.map((branch, index) => (
              <option key={index} value={index}>
                Branch {index + 1} · {branch.length} plies
              </option>
            ))}
          </select>
        </label>
      )}
      <button onClick={sandbox.exit}>Return to game</button>
    </section>
  );
}
