import { jest, describe, expect, test } from '@jest/globals';

jest.mock('dexie', () => {
  const DexieMock = class {
    activities = { add: jest.fn(), where: jest.fn() };
    version() { return { stores: () => this }; }
    open() { return Promise.resolve(); }
  };
  return { __esModule: true, default: DexieMock, Table: class {} };
});

import { addActivity, getActivitiesByDay, db } from '../db';
import type { ActivityItem } from '../types';

describe('db helpers', () => {
  test('addActivity normalizes date before adding', async () => {
    const addMock = db.activities.add as jest.Mock;
    addMock.mockResolvedValue('abc');
    const activity: ActivityItem = {
      id: '1',
      datum: '2024-05-04T10:00:00Z',
      kupac: 'Kupac',
      vrstaKontakta: 'telefon',
      tema: 'Tema',
      crmAzuriran: false
    };
    const pk = await addActivity(activity);
    expect(pk).toBe('abc');
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ datum: '2024-05-04' }));
  });

  test('getActivitiesByDay normalizes input date', async () => {
    const equalsMock = jest.fn().mockReturnValue({ sortBy: jest.fn() });
    const whereMock = jest.fn().mockReturnValue({ equals: equalsMock });
    (db.activities as any).where = whereMock;
    await getActivitiesByDay('2024-05-04T12:00:00Z');
    expect(equalsMock).toHaveBeenCalledWith('2024-05-04');
  });
});
