# Strata Daily Drill question bank

`tasks.json` holds the pool the Daily Drill draws from — 100 practical,
scenario-based tasks. There's no automatic rotation: each day an admin
picks one from the Daily Drill admin tab (it lists the whole bank) and
hits **Launch**, which starts the public clock. Until then the public
tab shows "goes live at 9am".

This file is never sent to visitors' browsers directly (the server
blocks it, since it holds the model answers) — only read by the server
to build each day's task. Judging is manual: there's no
"correct option" to check against, so every submission sits as
**pending** until an admin reads the contestant's written answers
against the model answer and marking guide here, and marks it correct
or incorrect from the Daily Drill admin tab.

## Format

Each entry:

```json
{
  "id": 1,
  "section": "Caretaker agreements and management rights",
  "title": "Pool cleaning frequency dispute",
  "scenario": "Riverbend Apartments CTS 40112. On Monday 5 October the committee secretary emails you: ...",
  "instructions": "1.\tIdentify what the agreement requires...\n2.\t...\n3.\t...",
  "modelAnswer": "Checks in order\n1.\t...\nCorrect outcome: ...\nExample response\n...",
  "markingGuide": "Competent:\n- ...\nNot yet competent:\n- ..."
}
```

Only `scenario`, `instructions`, `title` and `section` are ever shown
to contestants. `modelAnswer` and `markingGuide` are for the admin
judging screen only.

To add, remove or edit tasks: just edit this file and push like any
other change. `id` doesn't need to be unique or sequential — the
day's set of 10 is picked by position in the list, not by `id`.

## Set 2

`tasks-set2.json` is a second bank (65 questions, ids 101-165) in the same
format, plus `set`, `num`, `difficulty` and `topic`. Admin has a Set 1 / Set 2
switch on the question bank; launch from either. Set 2 has no model answers
yet (`modelAnswer` and `markingGuide` are empty).

Audio file names: Set 1 is `Scenario 1.mp3` / `Question 1.mp3`; Set 2 is
`Set 2 Scenario 1.mp3` / `Set 2 Question 1.mp3`. The number is the question's
number within its set, shown in admin.
