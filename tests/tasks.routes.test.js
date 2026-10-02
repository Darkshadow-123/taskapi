const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => taskService._reset());

const post = (body) => request(app).post('/tasks').send(body);

describe('POST /tasks', () => {
  it('creates a task (201) with defaults', async () => {
    const res = await post({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.priority).toBe('high');
    expect(res.body.status).toBe('todo');
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 for a missing title', async () => {
    const res = await post({ priority: 'low' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for an invalid status or dueDate', async () => {
    expect((await post({ title: 'a', status: 'pending' })).status).toBe(400);
    expect((await post({ title: 'a', dueDate: 'garbage' })).status).toBe(400);
  });
});

describe('GET /tasks', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all created tasks', async () => {
    await post({ title: 'a' });
    await post({ title: 'b' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    await post({ title: 'a', status: 'todo' });
    await post({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('b');
  });

  it('paginates: page 1 is the first page, page 2 the next', async () => {
    for (let i = 1; i <= 5; i++) await post({ title: `T${i}` });
    const p1 = await request(app).get('/tasks?page=1&limit=2');
    const p2 = await request(app).get('/tasks?page=2&limit=2');
    const p3 = await request(app).get('/tasks?page=3&limit=2');
    expect(p1.body.map((t) => t.title)).toEqual(['T1', 'T2']);
    expect(p2.body.map((t) => t.title)).toEqual(['T3', 'T4']);
    expect(p3.body.map((t) => t.title)).toEqual(['T5']);
  });

  it('defaults to page 1 / limit 10 when only one param is given', async () => {
    for (let i = 1; i <= 12; i++) await post({ title: `T${i}` });
    const res = await request(app).get('/tasks?page=1');
    expect(res.body).toHaveLength(10);
  });

  it('returns an empty page past the end', async () => {
    await post({ title: 'a' });
    const res = await request(app).get('/tasks?page=5&limit=10');
    expect(res.body).toEqual([]);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates a task', async () => {
    const { body: t } = await post({ title: 'old' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'new', priority: 'low' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('new');
    expect(res.body.priority).toBe('low');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid input', async () => {
    const { body: t } = await post({ title: 'old' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes a task (204, empty body)', async () => {
    const { body: t } = await post({ title: 'a' });
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });

  it('returns 404 for an unknown id', async () => {
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task done and sets completedAt', async () => {
    const { body: t } = await post({ title: 'a' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  it('returns counts by status and the overdue count', async () => {
    await post({ title: 'a' });
    await post({ title: 'b', status: 'in_progress', dueDate: '2000-01-01T00:00:00.000Z' });
    await post({ title: 'c', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  const assign = (id, body) => request(app).patch(`/tasks/${id}/assign`).send(body);

  it('assigns a task and returns the updated task', async () => {
    const { body: t } = await post({ title: 'a' });
    const res = await assign(t.id, { assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(t.id);
    expect(res.body.assignee).toBe('Alice');
  });

  it('persists the assignee', async () => {
    const { body: t } = await post({ title: 'a' });
    await assign(t.id, { assignee: 'Alice' });
    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Alice');
  });

  it('trims whitespace from the assignee', async () => {
    const { body: t } = await post({ title: 'a' });
    expect((await assign(t.id, { assignee: '  Alice ' })).body.assignee).toBe('Alice');
  });

  it('allows reassigning an already-assigned task', async () => {
    const { body: t } = await post({ title: 'a' });
    await assign(t.id, { assignee: 'Alice' });
    const res = await assign(t.id, { assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });

  it('returns 404 for an unknown task', async () => {
    expect((await assign('nope', { assignee: 'Alice' })).status).toBe(404);
  });

  it.each([[{}], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: 5 }], [{ assignee: null }]])(
    'returns 400 for invalid body %j',
    async (body) => {
      const { body: t } = await post({ title: 'a' });
      expect((await assign(t.id, body)).status).toBe(400);
    }
  );

  it('returns 400 for an over-long assignee', async () => {
    const { body: t } = await post({ title: 'a' });
    expect((await assign(t.id, { assignee: 'a'.repeat(101) })).status).toBe(400);
  });

  it('does not change the task when validation fails', async () => {
    const { body: t } = await post({ title: 'a' });
    await assign(t.id, { assignee: 'Alice' });
    await assign(t.id, { assignee: '' });
    expect((await request(app).get('/tasks')).body[0].assignee).toBe('Alice');
  });
});
