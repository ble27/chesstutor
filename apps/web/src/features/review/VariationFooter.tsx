import { ReplayControls } from "../replay/ReplayControls";
import type { Variation } from "./useVariation";

export function VariationFooter({
  selectedPly,
  lastPly,
  select,
  flip,
  variation,
}: {
  selectedPly: number;
  lastPly: number;
  select: (ply: number) => void;
  flip: () => void;
  variation?: Variation | undefined;
}) {
  const preview = variation?.kind === "variation" ? variation : null;
  return (
    <div className="review-footer">
      {preview && (
        <button
          onClick={() => {
            const triggerId = preview.triggerId;
            preview.exit();
            // The source candidate remounts after the preview is dismissed.
            requestAnimationFrame(() => {
              document
                .getElementById(triggerId ?? "explore-variation-0")
                ?.focus();
            });
          }}
        >
          Return to game
        </button>
      )}
      <ReplayControls
        selectedPly={preview?.step ?? selectedPly}
        lastPly={preview?.length ?? lastPly}
        select={preview?.select ?? select}
        flip={flip}
      />
      <p id="replay-help">
        {preview
          ? `Variation · ${preview.step} of ${preview.length} · recorded ply ${selectedPly}`
          : `Ply ${selectedPly} of ${lastPly}`}{" "}
        · Use Left/Right, Home or End in the replay area.
      </p>
    </div>
  );
}
