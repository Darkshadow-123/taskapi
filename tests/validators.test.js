const { validateCreateTask, validateUpdateTask, validateAssign } = require('../src/utils/validators');

describe('validateCreateTask', () => {
  it('accepts a minimal valid body', () => {
    expect(validateCreateTask({ title: 'ok' })).toBeNull();
  });

  it('accepts a fully populated valid body', () => {
    expect(
      validateCreateTask({ title: 'ok', status: 'done', priority: 'low', dueDate: '2030-01-01' })
    ).toBeNull();
  });

  it.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 42 }], [{ title: null }]])(
    'rejects bad title %j',
    (body) => {
      expect(validateCreateTask(body)).toBeTruthy();
    }
  );

  it('rejects unknown status, priority and unparseable dueDate', () => {
    expect(validateCreateTask({ title: 'a', status: 'pending' })).toBeTruthy();
    expect(validateCreateTask({ title: 'a', priority: 'urgent' })).toBeTruthy();
    expect(validateCreateTask({ title: 'a', dueDate: 'not-a-date' })).toBeTruthy();
  });
});

describe('validateUpdateTask', () => {
  it('accepts an empty body (nothing to change)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  it('accepts valid partial updates', () => {
    expect(validateUpdateTask({ status: 'in_progress', priority: 'high' })).toBeNull();
  });

  it('rejects an empty or non-string title when provided', () => {
    expect(validateUpdateTask({ title: '' })).toBeTruthy();
    expect(validateUpdateTask({ title: 5 })).toBeTruthy();
  });

  it('rejects invalid status, priority and dueDate', () => {
    expect(validateUpdateTask({ status: 'nope' })).toBeTruthy();
    expect(validateUpdateTask({ priority: 'nope' })).toBeTruthy();
    expect(validateUpdateTask({ dueDate: 'nope' })).toBeTruthy();
  });
});

describe('validateAssign', () => {
  it('accepts a normal name', () => {
    expect(validateAssign({ assignee: 'Alice' })).toBeNull();
  });

  it('accepts a name of exactly 100 characters', () => {
    expect(validateAssign({ assignee: 'a'.repeat(100) })).toBeNull();
  });

  it.each([[{}], [undefined], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: null }], [{ assignee: 7 }], [{ assignee: ['a'] }]])(
    'rejects %j',
    (body) => {
      expect(validateAssign(body)).toBeTruthy();
    }
  );

  it('rejects names longer than 100 characters', () => {
    expect(validateAssign({ assignee: 'a'.repeat(101) })).toBeTruthy();
  });
});
