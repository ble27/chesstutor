# S4 chess review — accepted by the user

Status: **accepted on 2026-11-05 by the user in the implementation session**.
No personal reviewer name was given. No findings or corrections were reported.
Product authority: [PRD §6](../PRD.md#6-analysis-presets-and-correctness) and
[plan S4](../../plan.md#s4--classification). Automated tests remain evidence for
legality and policy mechanics. This acceptance covers the decisions below; it
does not make `make verify` pass or start S5.

| Fixture / check | Automated evidence | User decision |
| --- | --- | --- |
| Exact WDL boundaries, both colors, Forced/Best precedence | `test_s4_classification.py` uses exact integer WDL ratios | Accepted. Published labels and uncertainty wording stand. |
| Missed mate after `1. f3 e5 2. g4`, Black plays `Ke7` | Real pinned Stockfish verifies `Qh4#` with legal mate; no exact score assertion | Accepted. Miss, because `Qh4` is checkmate, is the right conclusion. |
| Greek-gift sacrifice setup: `1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7 7. f4 O-O 8. Nf3 c5 9. Bd3 Nc6` | Synthetic engine/WDL fixture exercises `Bxh7+ Kxh7 Ng5+ Kg8 Qh5 Re8 Qh7+`, plus a separately checked safe bishop retreat | Accepted as a heuristic label. Synthetic WDL is not an engine assessment of this position. |
| Same sacrifice with strongest reply `Kh8` | Badge is conservatively withheld if the strongest checked reply declines the offer | Accepted. Withholding Brilliant is clear. |
| Ordinary starting-position `e4` versus `d4` | Artificial separated WDL values test Great uniqueness and restricted runner-up recheck | Accepted as a policy fixture. This is not a claim that `e4` is Great. |
| Cooperative queen loss in an engine PV | Material Miss is withheld when the opponent has another legal defense | Accepted. No unsupported forced-material claim. |
| Material captured at final PV ply followed by immediate recapture | Material Miss is withheld until a forcing post-capture response is inspected | Accepted. Horizon exclusion stands. |
| Partial, failed, cancelled and unknown-WDL analysis | No final conclusions or unsupported practice themes; missing evidence stays unclassified | Accepted. Partial coverage and provisional Quick wording stand. |

The acceptance is also recorded in [S4 evidence](S4.md).
