const { _, Chart, WebDataRocks } = globalThis;
let chart;
let pivot;
let view = 'pie';
let loaded = [];

export function reportRows(teachers) {
  return _.map(_.orderBy(teachers, ['full_name'], ['asc']), (teacher) => ({
    Name: teacher.full_name, Course: teacher.course, Country: teacher.country || 'Unknown',
    City: teacher.city, Age: teacher.age, Gender: teacher.gender,
    Birthday: String(teacher.b_day || '').slice(0, 10), Email: teacher.email,
    Phone: teacher.phone, Favorite: teacher.favorite ? 'Yes' : 'No',
  }));
}

function showReport() {
  if (!loaded.length) return;
  const rows = reportRows(loaded);
  const report = {
    dataSource: { data: [{ Name: { type: 'string' }, Course: { type: 'string' }, Country: { type: 'string' },
      City: { type: 'string' }, Age: { type: 'number' }, Gender: { type: 'string' },
      Birthday: { type: 'string' }, Email: { type: 'string' }, Phone: { type: 'string' }, Favorite: { type: 'string' } }, ...rows] },
    slice: view === 'countries'
      ? { rows: [{ uniqueName: 'Country' }], measures: [{ uniqueName: 'Name', aggregation: 'count', caption: 'Teachers' }] }
      : { rows: _.map(Object.keys(rows[0]), (uniqueName) => ({ uniqueName })) },
    options: { grid: { type: view === 'flat' ? 'flat' : 'classic', showHeaders: false,
      showGrandTotals: view === 'flat' ? 'off' : 'on', showTotals: 'off' } },
  };
  const container = document.querySelector('#pivot-report');
  container.dataset.ready = 'false';
  if (!pivot) {
    pivot = new WebDataRocks({ container: '#pivot-report', width: '100%', height: 460, toolbar: false,
      report, reportcomplete: () => { container.dataset.ready = 'true'; } });
  } else pivot.setReport(report);
}

export function renderStatistics(visible, teachers) {
  loaded = teachers;
  const groups = _.countBy(visible, (teacher) => teacher.country || 'Unknown');
  const labels = _.sortBy(Object.keys(groups));
  const data = { labels, datasets: [{ data: _.map(labels, (label) => groups[label]),
    backgroundColor: _.map(labels, (_, index) => `hsl(${index * 137.5 % 360} 62% 60%)`), borderWidth: 1 }] };
  if (!chart) chart = new Chart(document.querySelector('#statistics-pie'), { type: 'pie', data,
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } } } });
  else { chart.data = data; chart.update(); }
  document.querySelector('#statistics-pie').setAttribute('aria-label', 'Teachers by country: ' + _.map(labels, (label) => `${label}: ${groups[label]}`).join(', '));
  document.querySelector('#chart-empty').hidden = view !== 'pie' || visible.length > 0;
  if (view !== 'pie') showReport();
}

document.querySelector('.statistics-controls').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  view = button.dataset.view;
  for (const item of document.querySelectorAll('[data-view]')) item.setAttribute('aria-pressed', String(item === button));
  document.querySelector('#pie-container').hidden = view !== 'pie';
  document.querySelector('#pivot-report').hidden = view === 'pie';
  document.querySelector('#chart-empty').hidden = view !== 'pie' || chart.data.labels.length > 0;
  document.querySelector('#report-description').textContent = view === 'pie'
    ? 'The pie chart shows the current selection by country.'
    : view === 'countries' ? 'Country report: all loaded teachers.' : 'Flat table: all loaded teachers, one row per person.';
  if (view !== 'pie') showReport();
});
