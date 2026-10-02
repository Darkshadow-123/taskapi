const taskService = require('../src/services/taskService');

const make = (overrides = {}) => taskService.create({ title: 'Task', ...overrides });

beforeEach(() => taskService._reset());

describe('create', () => {
  it('applies defaults', () => {
    const t = make({ title: 'Write tests' });
    expect(t.title).toBe('Write tests');
    expect(t.description).toBe('');
    expect(t.status).toBe('todo');
    expect(t.priority).toBe('medium');
    expect(t.dueDate).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.assignee).toBeNull();
    expect(typeof t.id).toBe('string');
    expect(Number.isNaN(Date.parse(t.createdAt))).toBe(false);
  });

  it('keeps provided fields', () => {
    const t = make({ status: 'in_progress', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' });
    expect(t.status).toBe('in_progress');
    expect(t.priority).toBe('high');
    expect(t.dueDate).toBe('2030-01-01T00:00:00.000Z');
  });

  it('generates unique ids', () => {
    expect(make().id === make().id).toBe(false);
  });
});

describe('getAll / findById', () => {
  it('returns an empty array when there are no tasks', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all tasks', () => {
    make();
    make();
    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a copy of the list, not the internal array', () => {
    make();
    taskService.getAll().pop();
    expect(taskService.getAll()).toHaveLength(1);
  });

  it('finds a task by id and returns undefined for unknown ids', () => {
    const t = make();
    expect(taskService.findById(t.id).id).toBe(t.id);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  it('returns only tasks with the exact status', () => {
    make({ status: 'todo' });
    make({ status: 'done' });
    make({ status: 'done' });
    expect(taskService.getByStatus('done')).toHaveLength(2);
    expect(taskService.getByStatus('in_progress')).toHaveLength(0);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 25; i++) make({ title: `T${i}` });
  });

  it('page 1 returns the first `limit` tasks', () => {
    const r = taskService.getPaginated(1, 10);
    expect(r).toHaveLength(10);
    expect(r[0].title).toBe('T1');
    expect(r[9].title).toBe('T10');
  });

  it('page 2 continues where page 1 stopped', () => {
    const r = taskService.getPaginated(2, 10);
    expect(r[0].title).toBe('T11');
    expect(r[9].title).toBe('T20');
  });

  it('last page may be partial', () => {
    const r = taskService.getPaginated(3, 10);
    expect(r).toHaveLength(5);
    expect(r[0].title).toBe('T21');
  });

  it('page past the end is empty', () => {
    expect(taskService.getPaginated(4, 10)).toEqual([]);
  });
});

describe('getStats', () => {
  it('returns zeros when empty', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts by status', () => {
    make({ status: 'todo' });
    make({ status: 'in_progress' });
    make({ status: 'done' });
    make({ status: 'done' });
    expect(taskService.getStats()).toEqual({ todo: 1, in_progress: 1, done: 2, overdue: 0 });
  });

  it('counts overdue tasks only when past due and not done', () => {
    make({ dueDate: '2000-01-01T00:00:00.000Z' });
    make({ status: 'in_progress', dueDate: '2000-01-01T00:00:00.000Z' });
    make({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    make({ dueDate: '2999-01-01T00:00:00.000Z' });
    make();
    expect(taskService.getStats().overdue).toBe(2);
  });
});

describe('update', () => {
  it('merges fields and returns the updated task', () => {
    const t = make();
    const u = taskService.update(t.id, { title: 'New', priority: 'high' });
    expect(u.title).toBe('New');
    expect(u.priority).toBe('high');
    expect(taskService.findById(t.id).title).toBe('New');
  });

  it('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });
});

describe('remove', () => {
  it('removes an existing task', () => {
    const t = make();
    expect(taskService.remove(t.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  it('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  it('sets status to done and stamps completedAt', () => {
    const t = make();
    const c = taskService.completeTask(t.id);
    expect(c.status).toBe('done');
    expect(Number.isNaN(Date.parse(c.completedAt))).toBe(false);
    expect(taskService.findById(t.id).status).toBe('done');
  });

  it('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});

describe('assignTask', () => {
  it('stores the assignee and returns the updated task', () => {
    const t = make();
    const a = taskService.assignTask(t.id, 'Alice');
    expect(a.assignee).toBe('Alice');
    expect(taskService.findById(t.id).assignee).toBe('Alice');
  });

  it('trims surrounding whitespace', () => {
    const t = make();
    expect(taskService.assignTask(t.id, '  Bob  ').assignee).toBe('Bob');
  });

  it('allows reassignment', () => {
    const t = make();
    taskService.assignTask(t.id, 'Alice');
    expect(taskService.assignTask(t.id, 'Bob').assignee).toBe('Bob');
  });

  it('does not touch other fields', () => {
    const t = make({ priority: 'high', title: 'Keep me' });
    const a = taskService.assignTask(t.id, 'Alice');
    expect(a.title).toBe('Keep me');
    expect(a.priority).toBe('high');
    expect(a.id).toBe(t.id);
  });

  it('returns null for an unknown id', () => {
    expect(taskService.assignTask('nope', 'Alice')).toBeNull();
  });
});
