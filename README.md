# Task Manager API — Take-Home Submission

## Setup
```bash
npm install
npm start        # http://localhost:3000
npm test         # run the test suite
npm run coverage # run with coverage report
```

Node 18+ required. The data store is in-memory and resets on restart.

## What's here
```text
src/
  app.js                  # Express app setup
  routes/tasks.js         # Route handlers, including the new /assign endpoint
  services/taskService.js # Business logic + in-memory store
  utils/validators.js     # Input validation
tests/
  taskService.test.js     # Unit tests for the service layer
  validators.test.js      # Unit tests for the validators
  tasks.routes.test.js    # Supertest integration tests for every route,
                           # including the new PATCH /tasks/:id/assign
  knownBugs.test.js        # One it.failing test per unfixed bug (see below)
BUG_REPORT.md             # Bug write-up + design notes for /assign + submission note
```

Task status values are `todo` | `in_progress` | `done` (matches ASSIGNMENT.md; the project's original top-level README listed a different set — see BUG_REPORT.md).

## Test results

Run `npm run coverage` and paste the summary here before submitting:

```text
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.46 |    97.75 |   93.33 |   97.22 |                   
 src             |   69.23 |       75 |       0 |   69.23 |                   
  app.js         |   69.23 |       75 |       0 |   69.23 | 10-11,17-18       
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |    94.73 |     100 |     100 |                   
  taskService.js |     100 |    94.73 |     100 |     100 | 22                
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------
```

## Bugs, fix, and the assign endpoint

Full details — what's expected, what actually happens, how each bug was found, and a fix sketch — are in `BUG_REPORT.md`. Short version:

1. **Pagination skips page 1 (fixed)** — `getPaginated` treated pages as 0-indexed while the route defaults to page=1.
2. **Status filter matches substrings** (`?status=do` matches `todo` and `done`).
3. **Completing a task resets its priority to medium.**
4. **PUT lets clients overwrite id, createdAt, completedAt.**
5. **status and completedAt can end up inconsistent via PUT.**
6. **Status filter and pagination can't be used together** — pagination params are silently ignored when status is present.
7. **page/limit aren't validated** (negative values slip through).
8. **Validators use truthiness checks**, so `status: ""` or `priority: null` pass validation and get stored.

Bugs 2–8 are each pinned down by an `it.failing` test in `knownBugs.test.js`: it passes (confirming the bug is present) until the bug is fixed, at which point it starts failing — the cue to flip it to a normal `it`.

## PATCH /tasks/:id/assign
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "Alice"}'
```
- `assignee` must be a non-empty string (after trimming) up to 100 chars, else 400.
- Reassigning an already-assigned task is allowed and returns 200 — there's no ownership model here to protect, and forcing an unassign step first would be awkward for a routine handover.
- Unknown task id → 404.
- Unassigning (null/empty) is rejected; it would need its own explicit contract.

Reasoning in more detail is in `BUG_REPORT.md`.

## Submission note
- **What I'd test next:** malformed/huge request bodies, concurrent writes, the mutation-leak where create/service functions can return references into the store, and idempotency of complete.
- **What surprised me:** the silent priority reset inside completeTask, and that status filtering and pagination silently don't compose.
- **Questions before shipping:** persistence and ID strategy, auth/who may assign a task, whether assignee should be a user ID rather than free text, and whether the paginated response should include a total count.
