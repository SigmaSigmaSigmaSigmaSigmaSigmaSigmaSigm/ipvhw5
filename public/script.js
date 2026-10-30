import { getAge, normalizeUser, validateTeacher, fetchUsers, filterTeachers, sortTeachers, daysUntilBirthday, coordinatesOf } from './users.js';

import { renderStatistics } from './statistics.js';

const teachers = [];
let teacherMap;
let teacherMarker;

const list = document.querySelector('#teacher-list');
const favorites = document.querySelector('#favorites-list');
const template = document.createElement('article');
template.className = 'teacher-card';
template.innerHTML = '<button class="teacher-open" type="button"><span class="avatar"></span><span class="teacher-name"></span></button><p class="speciality"></p><p class="country"></p>';
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const country = document.querySelector('#region');
const info = document.querySelector('#info-dialog');
const add = document.querySelector('#add-dialog');
let currentTeacher;
let nextPage = 1;
let loading = false;
const seed = 'davydenko-lab5';
const loadMore = document.querySelector('#load-more');
const loadStatus = document.querySelector('#load-status');

function updateCountries() {
  const selected = country.value;
  country.replaceChildren(new Option('All', ''));
  for (const value of [...new Set(teachers.map((teacher) => teacher.country))].sort()) {
    if (value) country.add(new Option(value, value));
  }
  country.value = selected;
}

function makeCard(teacher) {
  const card = template.cloneNode(true);
  for (const key of Object.keys(card.dataset)) delete card.dataset[key];
  card.dataset.id = teacher.id;
  card.querySelector('.teacher-name').textContent = teacher.full_name;
  card.querySelector('.speciality').textContent = teacher.course;
  card.querySelector('.country').textContent = teacher.country;
  const avatar = card.querySelector('.avatar');
  avatar.replaceChildren();
  if (teacher.picture) {
    const image = document.createElement('img');
    image.src = teacher.picture;
    image.alt = '';
    avatar.append(image);
  } else {
    const initials = document.createElement('span');
    initials.className = 'initials';
    initials.textContent = teacher.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('.');
    avatar.style.backgroundColor = teacher.bg_color;
    avatar.append(initials);
  }
  card.querySelector('button').setAttribute('aria-label', `Information about ${teacher.full_name}`);
  if (teacher.favorite) {
    const star = document.createElement('span');
    star.className = 'favorite-badge';
    star.textContent = '★';
    star.setAttribute('aria-label', 'Favorite');
    card.append(star);
  }
  return card;
}

function render() {
  const query = search.value.trim().toLowerCase();
  const range = document.querySelector('#age').value;
  const [min, max] = range ? range.split('-').map(Number) : [0, Infinity];
  const gender = document.querySelector('#sex').value;
  const visible = sortTeachers(filterTeachers(teachers, { country: country.value, min, max, gender,
    favorite: document.querySelector('#only-favorites').checked,
    photo: document.querySelector('#with-photo').checked, query }),
    document.querySelector('#sort-field').value, document.querySelector('#sort-direction').value === 'desc');
  list.replaceChildren(...visible.map(makeCard));
  document.querySelector('#statistics-summary').textContent = `Shown: ${visible.length} / Total: ${teachers.length}`;
  favorites.replaceChildren(...teachers.filter((teacher) => teacher.favorite).map(makeCard));
  renderStatistics(visible, teachers);
}

function showTeacher(teacher) {
  currentTeacher = teacher;
  document.querySelector('#profile-photo').replaceChildren(makeCard(teacher).querySelector('.avatar').cloneNode(true));
  for (const [id, value] of Object.entries({ name: teacher.full_name, speciality: teacher.course,
    location: `${teacher.city}, ${teacher.country}`, demographics: `${teacher.age}, ${teacher.gender}`, notes: teacher.note })) {
    document.querySelector(`#profile-${id}`).textContent = value;
  }
  for (const field of ['email', 'phone']) {
    const link = document.querySelector(`#profile-${field}`);
    link.textContent = teacher[field];
    link.href = (field === 'email' ? 'mailto:' : 'tel:') + teacher[field];
    link.parentElement.hidden = !teacher[field];
  }
  const star = document.querySelector('#profile-favorite');
  star.textContent = teacher.favorite ? '★' : '☆';
  star.setAttribute('aria-pressed', String(teacher.favorite));
  star.setAttribute('aria-label', teacher.favorite ? 'Remove from favorites' : 'Add to favorites');
  const days = daysUntilBirthday(teacher.b_day);
  document.querySelector('#profile-birthday').textContent = days === null ? 'Birthday is unknown.'
    : days === 0 ? 'Birthday is today!' : `Days until next birthday: ${days}`;
  if (!info.open) info.showModal();
  const coordinates = coordinatesOf(teacher.coordinates);
  const mapContainer = document.querySelector('#teacher-map');
  mapContainer.hidden = !coordinates;
  document.querySelector('#map-status').textContent = coordinates ? 'Location from the supplied coordinates.' : 'Coordinates are not available.';
  if (coordinates) {
    if (!teacherMap) {
      teacherMap = L.map(mapContainer);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(teacherMap);
      teacherMarker = L.marker(coordinates).addTo(teacherMap);
    }
    teacherMarker.setLatLng(coordinates);
    teacherMap.setView(coordinates, 7);
    requestAnimationFrame(() => teacherMap.invalidateSize());
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('.add-teacher')) add.showModal();
  if (button.matches('.close-dialog')) button.closest('dialog').close();
  if (button.matches('.teacher-open')) showTeacher(teachers.find((teacher) => teacher.id === button.closest('.teacher-card').dataset.id));
  if (button.id === 'profile-favorite') {
    currentTeacher.favorite = !currentTeacher.favorite;
    render();
    showTeacher(currentTeacher);
  }

});
search.addEventListener('input', render);
filters.addEventListener('change', render);
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.target.id !== 'teacher-form') return;
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const teacher = { full_name: data.name.trim(), course: data.speciality,
    country: data.country, city: data.city.trim(), age: getAge(data.birth), b_day: data.birth,
    gender: data.sex, email: data.email.trim(), phone: data.phone.trim(), note: data.notes.trim(),
    bg_color: data.color, picture: '', favorite: false };
  const status = document.querySelector('#form-status');
  const validationError = validateTeacher(teacher);
  if (!form.reportValidity() || validationError) {
    status.textContent = validationError;
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  status.textContent = 'Saving…';
  try {
    const response = await fetch('/teachers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacher), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const saved = await response.json();
    if (!saved.id) throw new Error('Server did not return an ID');
    teachers.push({ ...teacher, id: String(saved.id) });
  } catch (error) {
    status.textContent = `Could not save teacher: ${error.message}. Check the server before retrying.`;
    return;
  } finally {
    submit.disabled = false;
  }
  status.textContent = '';
  form.reset();
  filters.reset();
  search.value = '';
  updateCountries();
  render();
  add.close();
});

const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
document.querySelector('[name="birth"]').max = today.toISOString().slice(0, 10);
updateCountries();
render();
loadMore.addEventListener('click', loadTeachers);
loadTeachers();

async function loadTeachers() {
  if (loading) return;
  loading = true;
  loadMore.disabled = true;
  loadStatus.textContent = 'Loading teachers…';
  try {
    const amount = nextPage === 1 ? 50 : 10;
    const users = await fetchUsers(nextPage, amount, seed);
    const known = new Set(teachers.map((teacher) => teacher.id));
    let added = 0;
    for (const teacher of _.map(users, normalizeUser)) {
      if (!known.has(teacher.id)) {
        teachers.push(teacher);
        known.add(teacher.id);
        added++;
      }
    }
    nextPage = nextPage === 1 ? 6 : nextPage + 1;
    updateCountries();
    render();
    loadStatus.textContent = `Loaded ${added} teachers.`;
  } catch (error) {
    loadStatus.textContent = `Could not load teachers: ${error.message}. Press the button to retry.`;
  } finally {
    loading = false;
    loadMore.disabled = false;
    loadMore.textContent = nextPage === 1 ? 'Retry loading 50' : 'Next 10';
  }
}
