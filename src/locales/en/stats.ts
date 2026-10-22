// The statistics page: library totals and reading history by month or year.
export default {
  title: 'Statistics',
  intro: 'Your library and your reading. Books finished and time spent reading are recorded from now on.',
  loadFailed: 'The statistics could not be loaded.',
  totals: {
    books: 'Books',
    size: 'Library size',
    read: 'Books read',
    time: 'Reading time',
  },
  period: {
    label: 'Group by',
    month: 'Month',
    year: 'Year',
  },
  charts: {
    booksRead: 'Books read',
    time: 'Reading time',
    libraryGrowth: 'Books in the library',
    libraryGrowthAria: 'Books in the library at the end of each {{period}}',
    libraryGrowthNote: 'Counted from the date each book was added; books removed since are not included.',
    empty: 'Nothing recorded for this period yet.',
    booksReadAria: 'Books read per {{period}}',
    timeAria: 'Reading time per {{period}}',
    periodMonth: 'month',
    periodYear: 'year',
  },
  duration: {
    minutes: '{{count}} min',
    hours: '{{count}} h',
    hoursMinutes: '{{hours}} h {{minutes}} min',
  },
  barBooks_one: '{{count}} book',
  barBooks_other: '{{count}} books',
};
