# Engine hosting and accuracy-preserving acceleration

Researched 2026-11-03. Research only; no service calls containing game data,
deployment, account creation, runtime changes, or new benchmarks performed.
This supplements [existing performance research](research-analysis-speed.md).

## Free public compute and hosting

| Option | Verified offer | Assessment for this application |
| --- | --- | --- |
| Lichess cloud evaluation | Cached position evaluations, up to five variations; missing positions return 404. Documentation asks for occasional queries and directs bulk consumers to exports. | Useful optional cache, not a fresh whole-game analysis service. |
| Chess-API.com | Free position REST/WebSocket API; documented maxima: depth 18, 100 ms thinking time, five variations. Higher limits require support. | Prototype candidate; no demonstrated equivalence to our evidence contract, availability guarantee, or whole-game latency guarantee. |
| Oracle Always Free A1 | Current official allowance: 1,500 OCPU-hours and 9,000 GB-hours/month, described as 2 OCPUs and 12 GB total. | Most plausible free VM candidate examined. Use native ARM64 engine; benchmark before assuming it beats the local Mac. Capacity may be unavailable; idle instances can be reclaimed. |
| Google Compute Engine free tier | One eligible e2-micro VM month's aggregate hours in selected US regions, with storage and transfer limits. | Poor candidate for sustained engine acceleration: e2-micro has 1 GB RAM and 0.25 fractional vCPU despite exposing two vCPUs. |

Sources: [Lichess endpoint specification](https://raw.githubusercontent.com/lichess-org/api/master/doc/specs/tags/analysis/api-cloud-eval.yaml),
[Chess-API documentation](https://chess-api.com/),
[Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm),
[Google free tier](https://docs.cloud.google.com/free/docs/free-cloud-features),
[Google machine specifications](https://docs.cloud.google.com/compute/docs/general-purpose-machines#e2_shared-core).
The suitability judgments in the table are inferences, not measured results.
Older Oracle 4-OCPU/24-GB guides should not be used to size a new free tenancy;
verify the actual account allowance before provisioning. Free-tier limits do
not make unrelated paid resources or overages free.

Lichess asks clients to issue one request at a time and back off on HTTP 429.
Do not fan out a game's positions against the public cache.
[API guidance](https://lichess-org.github.io/api/).
The examined offerings do not establish a free, unlimited, dependable service
that returns this application's complete analysis evidence for arbitrary games.
An external endpoint receives the supplied positions or move history; avoid
uploading private PGN metadata unnecessarily. A self-hosted engine retains
control of engine versions, full history and evidence schema.

## Performance recommendations

Repository inspection by the parent researcher confirms that 160 plies have
nominal sequential search budgets of 32 seconds in Quick and 240 seconds in
Deep, before overhead. The Mac host is ARM while Compose specifies an x86
worker; two replicas process separate games rather than splitting one game.
Live Docker inspection was unavailable, so actual running settings and the
reported 1–2-minute timing have not been reconciled with these presets.

Stockfish supports time and node search budgets, CPU Threads and Hash sizing.
Its documentation recommends MultiPV 1 for best performance and configuring
threads for the available cores. A faster CPU under the same fixed time budget
primarily increases work completed, rather than eliminating that time budget.
[Stockfish UCI documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html).

Recommended experiment order (proposals, not implementations):

1. Measure native ARM64 against the current emulated worker with identical
   engine/network/options. Record nodes/second, time, and legal output.
2. Use compatible cached evidence and avoid duplicate searches only when the
   same-root evidence requirements are satisfied. Preserve repetition history.
3. Benchmark a bounded pool processing independent positions, keeping the total
   engine threads within available CPU capacity. This trades CPU resources for
   elapsed time; adding workers alone need not parallelize a single game.
4. Evaluate node-budgeted MultiPV-1 screening with deeper verification for
   unstable or consequential positions. Clearly distinguish provisional results.
   This changes analysis policy and requires calibration; equal node counts do
   not prove equal chess accuracy.

Validate speed changes against a substantially stronger reference over diverse
games and tactical fixtures, measuring best-move agreement, score/classification
stability, missed tactics, mate handling and legal PVs. Include human chess review
and the repository's sprint gates before claiming preserved accuracy. Lowering
time/depth alone is not an accuracy-preserving optimization.

Documentation validation: inspected source pages and the relative note link;
checked new-file whitespace. No runtime tests were needed or run for this note.
