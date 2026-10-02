/**
 * Each `it.failing` below documents a real bug (see BUG_REPORT.md) by asserting
 * the CORRECT behaviour. Jest reports `it.failing` as passing while the bug exists,
 * and as a failure once the bug is fixed, which is the cue to change it to a plain `it`.
 */
const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');
const { validateCreateTask } = require('../src/utils/validators');

beforeEach(() => taskService._reset());

describe('BUG 2: status filter uses substring matching', () => {
  it.failing('getByStatus("do") must not match "todo" or "done"', () => {
    taskService.create({ title: 'a', status: 'todo' });
    taskService.create({ title: 'b', status: 'done' });
    expect(taskService.getByStatus('do')).toEqual([]);
  });
});

describe('BUG 3: completing a task resets its priority', () => {
  it.failing('completeTask keeps the original priority', () => {
    const t = taskService.create({ title: 'a', priority: 'high' });
    expect(taskService.completeTask(t.id).priority).toBe('high');
  });
});

describe('BUG 4: update() lets callers overwrite protected fields', () => {
  it.failing('update ignores id / createdAt / completedAt', () => {
    const t = taskService.create({ title: 'a' });
    const u = taskService.update(t.id, { id: 'hacked', createdAt: '1999-01-01T00:00:00.000Z' });
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
  });
});

describe('BUG 5: status can be changed without keeping completedAt consistent', () => {
  it.failing('moving a task to "done" via update sets completedAt', () => {
    const t = taskService.create({ title: 'a' });
    expect(taskService.update(t.id, { status: 'done' }).completedAt).not.toBeNull();
  });

  it.failing('moving a task out of "done" via update clears completedAt', () => {
    const t = taskService.create({ title: 'a' });
    taskService.completeTask(t.id);
    expect(taskService.update(t.id, { status: 'todo' }).completedAt).toBeNull();
  });
});

describe('BUG 6: status filter and pagination cannot be combined', () => {
  it.failing('GET /tasks?status=todo&limit=2 returns at most 2 tasks', async () => {
    for (let i = 0; i < 3; i++) taskService.create({ title: `T${i}`, status: 'todo' });
    const res = await request(app).get('/tasks?status=todo&limit=2');
    expect(res.body).toHaveLength(2);
  });
});

describe('BUG 7: negative page / limit are accepted', () => {
  it.failing('GET /tasks?page=-1 is rejected with 400', async () => {
    expect((await request(app).get('/tasks?page=-1&limit=10')).status).toBe(400);
  });

  it.failing('GET /tasks?limit=-5 is rejected with 400', async () => {
    expect((await request(app).get('/tasks?limit=-5')).status).toBe(400);
  });
});

describe('BUG 8: create validator uses truthiness checks', () => {
  it.failing('rejects status: "" (would be stored as an empty status)', () => {
    expect(validateCreateTask({ title: 'a', status: '' })).toBeTruthy();
  });

  it.failing('rejects priority: null (defaults do not apply to null)', () => {
    expect(validateCreateTask({ title: 'a', priority: null })).toBeTruthy();
  });
});
