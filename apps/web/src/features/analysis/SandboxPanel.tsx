import type { Sandbox } from "./useSandbox";
import { SelectField } from "../../components/ui/Select";

export function SandboxPanel({ sandbox }: { sandbox: Sandbox }) {
  const lastBranch = sandbox.position?.positions
    .map((move) => move.san)
    .join(" ");
  return (
    <section className="sandbox-panel" aria-label="Branch">
      <div className="module-heading">
        <h2>Branch</h2>
        <span>{sandbox.branch.length}/100 plies</span>
      </div>
      {lastBranch && <p className="branch-notation">{lastBranch}</p>}
      {sandbox.position?.claimable_draw && <p>Draw claim available</p>}
      {sandbox.position?.result && <p>Result {sandbox.position.result}</p>}
      {sandbox.error && <p role="alert">{sandbox.error}</p>}
      {sandbox.saved.length > 0 && (
        <SelectField
          label="Saved branches"
          value=""
          disabled={sandbox.busy}
          onChange={(value) => sandbox.choose(Number(value))}
          options={sandbox.saved.map((branch, index) => ({
            value: String(index),
            label: `Branch ${index + 1} · ${branch.length} plies`,
          }))}
        />
      )}
    </section>
  );
}
