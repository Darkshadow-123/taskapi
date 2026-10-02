# Bug Report

Statuses used by the code are `todo | in_progress | done` (matches ASSIGNMENT.md; the README lists a different set, see "Docs" below).
Bugs 2-8 are documented by `it.failing` tests in `tests/knownBugs.test.js`; they flip to failures once fixed, which is the cue to convert them to plain `it`.

## Bug 1: Pagination skips the first page (FIXED)
- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `?page=1&limit=10` returns tasks 1-10.
- **Actual:** returns tasks 11-20; page 1 of a 10-task list is empty, so the first `limit` tasks are unreachable.
- **Why:** `offset = page * limit` treats pages as 0-indexed, but the route defaults to `page = 1` (1-indexed).
- **Found by:** the "page 1 returns the first `limit` tasks" unit test.
- **Fix:** `offset = (page - 1) * limit`. Tests in `taskService.test.js` and `tasks.routes.test.js` now cover it.

## Bug 2: Status filter matches substrings
- **Where:** `taskService.js`, `getByStatus` (`t.status.includes(status)`)
- **Expected:** `?status=done` returns only `done` tasks; an unknown status returns nothing (or 400).
- **Actual:** `?status=do` returns both `todo` and `done`; `?status=progress` matches `in_progress`.
- **Why:** `String.prototype.includes` instead of strict equality.
- **Fix:** `t.status === status` (optionally 400 for values outside `VALID_STATUSES`).

## Bug 3: Completing a task silently resets priority
- **Where:** `taskService.js`, `completeTask` (`priority: 'medium'`)
- **Expected:** only `status` and `completedAt` change.
- **Actual:** a `high` priority task becomes `medium` after `PATCH /:id/complete`.
- **Fix:** delete the `priority: 'medium'` line.

## Bug 4: PUT can overwrite protected fields (mass assignment)
- **Where:** `taskService.js`, `update` (`{ ...tasks[index], ...fields }`) with `validateUpdateTask` not restricting keys.
- **Expected:** `id`, `createdAt`, `completedAt` are not client-writable; unknown keys are ignored.
- **Actual:** `PUT /tasks/:id {"id":"x","createdAt":"1999-..."}` rewrites them, and arbitrary extra properties are stored.
- **Fix:** whitelist `title, description, status, priority, dueDate` (and `assignee` if desired) before merging.

## Bug 5: `status` and `completedAt` can disagree
- **Where:** `taskService.js`, `update`
- **Expected:** moving to `done` sets `completedAt`; moving out of `done` clears it.
- **Actual:** `PUT {status:"done"}` leaves `completedAt: null`; `PUT {status:"todo"}` on a completed task keeps the old `completedAt`.
- **Fix:** derive `completedAt` from status transitions inside `update` (ideally share logic with `completeTask`).
- **Related:** completing an already-completed task overwrites `completedAt` (not idempotent); worth a decision.

## Bug 6: Status filter and pagination cannot be combined
- **Where:** `src/routes/tasks.js`, `GET /` (early `return` inside `if (status)`)
- **Expected:** `?status=todo&page=1&limit=2` filters, then paginates (the API table lists both).
- **Actual:** `page`/`limit` are silently ignored whenever `status` is present.
- **Fix:** filter first, then paginate the filtered list (change `getPaginated` to accept a list, or paginate in the route).

## Bug 7: No validation of `page` / `limit`
- **Where:** `routes/tasks.js` (`parseInt(page) || 1`)
- **Expected:** non-positive or non-numeric values are rejected (400) or clamped; there is a sensible max limit.
- **Actual:** `page=-1` is truthy so it passes through and `slice` with negative indices returns items from the end of the list; `limit=-5` returns `[]`; `limit=1000000` is allowed.
- **Fix:** validate positive integers, cap `limit`.

## Bug 8: Create/update validators use truthiness checks
- **Where:** `src/utils/validators.js` (`if (body.status && ...)`, same for priority / dueDate)
- **Expected:** any provided-but-invalid value is rejected.
- **Actual:** `status: ""` passes validation, and because default parameters only apply to `undefined`, the empty string (or `null` priority) is stored on the task. `description` type is never checked.
- **Fix:** test `!== undefined` instead of truthiness, and validate `description` is a string.

## Docs
README lists statuses `pending | in-progress | completed`, which the code rejects. ASSIGNMENT.md (`todo | in_progress | done`) matches the code. Also, no `GET /tasks/:id` exists.

# `PATCH /tasks/:id/assign` design notes
- **Validation:** `assignee` must be a string, non-empty after trimming, max 100 chars, else 400. The trimmed value is stored.
- **Order of checks:** validate body (400), then look up the task (404), same order as `PUT`.
- **Already assigned:** reassignment is allowed and returns 200. A 409 would force clients into unassign-then-assign for a routine handover and there is no ownership model to protect.
- **Unassign:** `null`/empty is rejected; unassigning would deserve its own explicit contract.
- **Completed tasks:** can still be assigned (e.g. attributing finished work).
- **Task shape:** new tasks now include `assignee: null` so the shape is consistent.
- **Style:** immutable update, same as the other service functions.

# Submission note
- **Test next:** input fuzzing on routes (malformed JSON, huge bodies), concurrency, the mutation-leak in `create` (returns the stored object), and idempotency of `complete`.
- **Surprises:** the `priority` reset in `completeTask`, and that the tests directory started empty although `_reset` already existed for tests.
- **Questions before production:** persistence and IDs, auth and who may assign, whether `assignee` should be a user ID instead of free text, pagination response shape (total count), and the intended status vocabulary.
