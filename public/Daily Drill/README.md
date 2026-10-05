# Strata Daily Drill question bank

`tasks.json` holds the pool the Daily Drill draws from — 100 practical,
scenario-based tasks. Each day's drill pulls the next 10 in order
(day 1 → tasks 1–10, day 2 → tasks 11–20, …), wrapping back to task 1
after 10 days.

This file is never sent to visitors' browsers directly (the server
blocks it, since it holds the model answers) — only read by the server
to build each day's set of tasks. Judging is manual: there's no
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
