# Daily Quiz question bank

`questions.json` holds the pool the Daily Quiz draws from — one question
shown per day, rotating through the list in order and wrapping back to
the start once it runs out (so after 100 days it starts over at
question 1, unless you've added more by then).

This file is never sent to visitors' browsers directly (the server
blocks it, since it holds the correct answers) — only read by the
server to build each day's question and mark answers.

## Format

Each entry:

```json
{
  "id": 1,
  "section": "Caretaker agreements and management rights",
  "question": "A committee says the caretaker must clean the pool area daily, but the agreement only says weekly. What governs?",
  "options": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "..."
  },
  "correctOption": "A"
}
```

To add, remove or edit questions: just edit this file and push like any
other change. `id` doesn't need to be unique or sequential — the day's
question is picked by position in the list, not by `id`.
