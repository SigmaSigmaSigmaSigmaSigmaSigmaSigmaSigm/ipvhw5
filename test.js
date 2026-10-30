import { test } from 'node:test';
import assert from 'node:assert/strict';
import lodash from 'lodash';
import dayjs from 'dayjs';
globalThis._ = lodash;
globalThis.dayjs = dayjs;
const { getAge, normalizeUser, matchesSearch, validateTeacher, fetchUsers, courses, filterTeachers, sortTeachers, daysUntilBirthday, coordinatesOf } = await import('./public/users.js');

const user = { login: { uuid: 'uuid-1' }, name: { first: 'Anna', last: 'Test' }, location: { country: 'Ukraine', city: 'Kyiv', coordinates: { latitude: '50.45', longitude: '30.52' } }, dob: { age: 31, date: '1995-01-01' }, email: 'anna@example.com', gender: 'female', phone: '+380 67 123 4567', picture: { large: 'https://example.com/photo.jpg' } };

test('Форматування', () => {
  const teacher = normalizeUser(user);
  assert.equal(teacher.id, 'uuid-1');
  assert.equal(teacher.full_name, 'Anna Test');
  assert.ok(courses.includes(teacher.course));
  assert.deepEqual(coordinatesOf(teacher.coordinates), [50.45, 30.52]);
  assert.equal(validateTeacher(teacher), '');
});

test('Фільтри та пошук', () => {
  const teacher = { ...normalizeUser(user), note: 'Chess club', favorite: true };
  const others = [{ ...teacher, id: 'other', age: 3, country: 'France' }, { ...teacher, favorite: false }];
  assert.equal(matchesSearch(teacher, ' ANNA '), true);
  assert.equal(matchesSearch(teacher, 'club'), true);
  assert.equal(matchesSearch(teacher, '31'), true);
  assert.equal(matchesSearch(teacher, '3'), false);
  assert.deepEqual(filterTeachers([teacher, ...others], { country: 'Ukraine', gender: 'female', min: 30, max: 40, favorite: true, photo: true, query: 'club' }), [teacher]);
});

test('Сортування', () => {
  const users = [{ full_name: 'B', age: 31 }, { full_name: 'A', age: 3 }];
  assert.equal(sortTeachers(users, 'age')[0].age, 3);
  assert.equal(sortTeachers(users, 'age', true)[0].age, 31);
  assert.equal(sortTeachers(users, 'full_name')[0].full_name, 'A');
  assert.equal(users[0].age, 31);
});

test('Дні до дня народження', () => {
  assert.equal(daysUntilBirthday('2000-10-30', '2026-10-30'), 0);
  assert.equal(daysUntilBirthday('2000-10-31', '2026-10-30'), 1);
  assert.equal(daysUntilBirthday('2000-01-01', '2026-12-31'), 1);
  assert.equal(daysUntilBirthday('2000-02-29', '2027-02-27'), 1);
  assert.equal(daysUntilBirthday('2000-02-29', '2028-02-28'), 1);
  assert.equal(daysUntilBirthday('2000-02-29', '2028-03-01'), 364);
  for (const bad of ['', 'invalid', '2000-02-30', '2999-01-01']) {
    assert.equal(daysUntilBirthday(bad, '2026-10-30'), null);
    assert.ok(Number.isNaN(getAge(bad)));
  }
});

test('Координати', () => {
  assert.deepEqual(coordinatesOf({ latitude: 0, longitude: 0 }), [0, 0]);
  for (const bad of [null, {}, { latitude: true, longitude: 30 }, { latitude: '', longitude: 30 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) assert.equal(coordinatesOf(bad), null);
});

test('Валідація', () => {
  const teacher = normalizeUser(user);
  for (const change of [{ full_name: ' ' }, { email: 'bad@' }, { age: NaN }, { gender: '' }, { phone: '-------' }, { phone: '123' }]) assert.notEqual(validateTeacher({ ...teacher, ...change }), '');
  assert.equal(validateTeacher({ ...teacher, phone: '' }), '');
});

test('Запити', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.searchParams.get('results'), '1');
    assert.equal(url.searchParams.get('page'), '6');
    return new Response(JSON.stringify({ results: [user] }));
  });
  assert.deepEqual(await fetchUsers(6, 1, 'test'), [user]);
  mock.mock.mockImplementation(async () => new Response('', { status: 503 }));
  await assert.rejects(fetchUsers(6, 1, 'test'), /HTTP 503/);
  mock.mock.mockImplementation(async () => new Response('null'));
  await assert.rejects(fetchUsers(6, 1, 'test'), /Invalid user data/);
});
