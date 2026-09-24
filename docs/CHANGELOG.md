# Changelog

## 2026-09-23

What: Satellite under the hexes, a policy ledger with undo, 2 AP a year, and a kibbutz well.
Why: The raw grid was sterile, the action budget was too fast for a board this fine, and a settlement is not the National Water Carrier.
How: NASA January 2003 image in `public/israel-2003.jpg`, desert hexes tinted. Hula (12 hexes, dug 1951-1957) sets the pace at 2 AP. Undo pops the last policy line. A kibbutz well is flow 1 and only the next hex.

What: A year is a Tikal-style water policy. Lines cost cash and action points. Commit is what builds them.
Why: The fine board is too long for one immediate action, and spending needed a running bill you can still edit.
How: `policy` on the model, `queueAction` / `dropPolicyItem` / `commitPolicy`. The view-model replays the draft so the next hex lights up before commit. 6 AP a year.

What: MVVM split for Ditches and Desert, plus model and view-model tests.
Why: The ditch rules were trapped in the React file, so a bad filter (lake is not a road, allocated color) was only visible by playing.
How: `src/game/model` owns the board and transitions. `src/game/viewmodel/present.ts` is the filter the screen renders. Tests run under `node --experimental-strip-types`.
