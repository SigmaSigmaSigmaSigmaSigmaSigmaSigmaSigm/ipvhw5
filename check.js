// Виконати в консолі після завантаження 50 викладачів. Додає і видаляє один тестовий запис.
(async () => {
  const $ = (selector) => document.querySelector(selector);
  const count = () => $('#teacher-list').children.length;
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = async (fn) => {
    const end = Date.now() + 25000;
    while (!fn()) { if (Date.now() > end) throw new Error('UI timeout'); await new Promise((resolve) => setTimeout(resolve, 30)); }
  };
  const total = () => Chart.getChart('statistics-pie').data.datasets[0].data.reduce((a, b) => a + b, 0);
  const names = () => [...document.querySelectorAll('#teacher-list .teacher-name')].map((item) => item.textContent);
  const select = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
  const search = (text) => { $('#search').value = text; $('#search').dispatchEvent(new Event('input')); };
  const report = async (view) => {
    $(`[data-view="${view}"]`).click();
    await wait(() => $('#pivot-report').dataset.ready === 'true');
    return webdatarocks.getReport();
  };
  check(count() === 50 && total() === 50, 'Initial data and pie chart');
  $('#teacher-list .teacher-open').click();
  check($('#info-dialog').open, 'Teacher popup');
  check($('#teacher-map .leaflet-marker-icon'), 'Leaflet marker');
  check(/Days until next birthday: \d+|Birthday is today!/.test($('#profile-birthday').textContent), 'Birthday countdown');
  $('#profile-favorite').click();
  check($('#favorites-list').children.length === 1, 'Favorite');
  $('#info-dialog .close-dialog').click();
  $('#only-favorites').checked = true;
  $('#filters').dispatchEvent(new Event('change'));
  check(count() === 1 && total() === 1, 'Favorite filter updates chart');
  $('#filters').reset();
  $('#filters').dispatchEvent(new Event('change'));
  const name = names()[0];
  search(name);
  check(count() === 1 && total() === 1, 'Search updates chart');
  search('no-such-teacher-xyz');
  check(count() === 0 && total() === 0 && !$('#chart-empty').hidden, 'Empty selection');
  const countries = await report('countries');
  check(countries.options.grid.type === 'classic', 'Country report');
  check(countries.slice.rows[0].uniqueName === 'Country', 'Country grouping');
  check(countries.dataSource.data.length === 51, 'Report includes all 50 teachers despite filter');
  const flat = await report('flat');
  check(flat.options.grid.type === 'flat', 'Flat report');
  check(flat.dataSource.data.length === 51, 'All records in flat report');
  const columns = flat.slice.rows.map((row) => row.uniqueName);
  check(['Name', 'Course', 'Country', 'City', 'Age', 'Gender', 'Birthday', 'Email', 'Phone', 'Favorite'].every((field) => columns.includes(field)), 'Column names');
  const data = flat.dataSource.data.slice(1);
  $('[data-view="pie"]').click();
  search('');
  for (const [field, column] of Object.entries({ full_name: 'Name', course: 'Course', age: 'Age', country: 'Country', b_day: 'Birthday' })) {
    for (const direction of ['asc', 'desc']) {
      select('#sort-field', field);
      select('#sort-direction', direction);
      const expected = _.orderBy(data, [(row) => typeof row[column] === 'number' ? row[column] : row[column].toLowerCase()], [direction]).map((row) => row[column]);
      const actual = names().map((name) => data.find((row) => row.Name === name)[column]);
      check(JSON.stringify(actual) === JSON.stringify(expected), `Sort ${field} ${direction}`);
    }
  }
  $('#load-more').click();
  await wait(() => !$('#load-more').disabled);
  check(count() === 60 && total() === 60, 'Next 10');
  check((await report('flat')).dataSource.data.length === 61, 'Flat report updates after pagination');
  $('[data-view="pie"]').click();
  let savedId;
  try {
    $('header .add-teacher').click();
    const form = $('#teacher-form');
    const values = { name: '<b>Library Test Teacher</b>', email: `library-test-${Date.now()}@example.com`, sex: 'female', birth: '2000-01-01', notes: 'Library browser test note' };
    for (const [key, value] of Object.entries(values)) form.elements[key].value = value;
    form.requestSubmit();
    await wait(() => !$('#add-dialog').open);
    check(count() === 61 && total() === 61, 'POST adds teacher and updates chart');
    const saved = await (await fetch('/teachers')).json();
    savedId = saved.find((item) => item.email === values.email)?.id;
    check(savedId, 'Server persistence');
    search(values.notes);
    check(count() === 1 && !$('#teacher-list .teacher-name b'), 'Escaped form text and note search');
    $('#teacher-list .teacher-open').click();
    check($('#teacher-map').hidden && $('#map-status').textContent.includes('not available'), 'Missing coordinates');
    check(/Days until next birthday: \d+|Birthday is today!/.test($('#profile-birthday').textContent), 'Added teacher birthday');
    $('#info-dialog .close-dialog').click();
    search('');
    const updated = await report('flat');
    check(updated.dataSource.data.length === 62, 'All 61 loaded teachers in report');
    check(updated.dataSource.data.some((row) => row.Name === values.name), 'Added teacher in report');
    check(!$('#pivot-report').querySelector('b'), 'Report text must not become HTML');
    $('[data-view="pie"]').click();
    check(document.documentElement.scrollWidth <= innerWidth, 'No horizontal overflow');
    return 'OK';
  } finally {
    if (savedId) {
      const response = await fetch('/teachers/' + encodeURIComponent(savedId), { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove browser-test record');
    }
  }
})();
