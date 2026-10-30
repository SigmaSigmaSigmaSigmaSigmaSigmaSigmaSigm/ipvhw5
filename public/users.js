const { _, dayjs } = globalThis;
export const courses = ['Mathematics', 'Physics', 'English', 'Computer Science', 'Dancing', 'Chess', 'Biology', 'Chemistry', 'Law', 'Art', 'Medicine', 'Statistics'];

export function getAge(birthday) {
  const date = String(birthday || '').slice(0, 10);
  const birth = dayjs(date);
  if (!date || !birth.isValid() || birth.format('YYYY-MM-DD') !== date || birth.isAfter(dayjs(), 'day')) return NaN;
  return dayjs().diff(birth, 'year');
}

export function normalizeUser(user) {
  return {
    id: _.get(user, 'login.uuid'), full_name: _.trim(`${_.get(user, 'name.first', '')} ${_.get(user, 'name.last', '')}`),
    course: _.sample(courses), country: _.get(user, 'location.country', ''), city: _.get(user, 'location.city', ''),
    coordinates: _.get(user, 'location.coordinates', null), age: _.get(user, 'dob.age'), b_day: _.get(user, 'dob.date', ''),
    gender: _.get(user, 'gender', ''), email: _.get(user, 'email', ''), phone: _.get(user, 'phone', ''),
    picture: _.get(user, 'picture.large', ''), favorite: false, note: '', bg_color: '#ffffff',
  };
}

export function matchesSearch(teacher, query) {
  const text = _.toLower(_.trim(query));
  if (!text) return true;
  if (/^\d+$/.test(text)) return teacher.age === Number(text);
  return _.some([teacher.full_name, teacher.note], (value) => _.includes(_.toLower(value), text));
}

export function filterTeachers(teachers, { country = '', min = 0, max = Infinity, gender = '', favorite = false, photo = false, query = '' } = {}) {
  return _.filter(teachers, (teacher) => _.every([
    !country || teacher.country === country, teacher.age >= min && teacher.age <= max,
    !gender || teacher.gender === gender, !favorite || teacher.favorite,
    !photo || Boolean(teacher.picture), matchesSearch(teacher, query),
  ]));
}

export function sortTeachers(teachers, field = 'full_name', descending = false) {
  return _.orderBy(teachers, [(teacher) => _.isNumber(teacher[field]) ? teacher[field] : _.toLower(teacher[field])], [descending ? 'desc' : 'asc']);
}

export function validateTeacher(teacher) {
  if (!_.isString(teacher.full_name) || !_.trim(teacher.full_name)) return 'Enter a name.';
  if (!_.isString(teacher.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) return 'Enter a valid email.';
  if (!_.isFinite(teacher.age) || teacher.age < 0) return 'Enter a valid date of birth, not in the future.';
  if (!_.includes(['male', 'female'], teacher.gender)) return 'Select a sex.';
  if (teacher.phone && (!_.isString(teacher.phone) || !_.every([
    /^[+()\d .-]{7,25}$/.test(teacher.phone), /^\d{7,15}$/.test(teacher.phone.replace(/\D/g, '')),
  ]))) return 'Enter a phone number with 7–15 digits.';
  return '';
}

export function coordinatesOf(coordinates) {
  const values = _.map(['latitude', 'longitude'], (key) => {
    const value = _.get(coordinates, key);
    return (!_.isNumber(value) && !_.isString(value)) || _.trim(String(value)) === '' ? NaN : Number(value);
  });
  return _.every(values, _.isFinite) && Math.abs(values[0]) <= 90 && Math.abs(values[1]) <= 180 ? values : null;
}

export function daysUntilBirthday(birthday, now = dayjs()) {
  const date = String(birthday || '').slice(0, 10);
  const birth = dayjs(date);
  const today = dayjs(now).startOf('day');
  if (!date || !birth.isValid() || birth.format('YYYY-MM-DD') !== date || birth.isAfter(today, 'day')) return null;
  const anniversary = (year) => {
    const month = today.year(year).date(1).month(birth.month());
    // Для 29 лютого в невисокосному році показуємо 28 лютого.
    return month.date(Math.min(birth.date(), month.daysInMonth()));
  };
  let next = anniversary(today.year());
  if (next.isBefore(today)) next = anniversary(today.year() + 1);
  return next.diff(today, 'day');
}

export async function fetchUsers(page, amount, seed) {
  const url = new URL('https://randomuser.me/api/');
  url.search = new URLSearchParams({ results: amount, page, seed }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!_.isArray(data?.results) || data.results.length !== amount || !_.every(data.results, (user) =>
    _.isString(_.get(user, 'login.uuid')) && _.get(user, 'login.uuid') && _.isString(_.get(user, 'name.first')) &&
    _.isString(_.get(user, 'name.last')) && _.isFinite(_.get(user, 'dob.age')) && _.isString(_.get(user, 'dob.date')))) {
    throw new Error(data?.error || 'Invalid user data');
  }
  return data.results;
}
