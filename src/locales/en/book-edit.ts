// The manual edit form of a book ("Edit details").
export default {
  title: 'Edit details',
  volumePlaceholder: '3, 12.1, HS…',
  datePlaceholder: 'YYYY, YYYY-MM or YYYY-MM-DD',
  authors: 'Authors',
  noAuthors: 'No authors.',
  firstName: 'First name',
  lastName: 'Last name',
  lastNamePlaceholder: 'Last name or pen name',
  role: 'Role',
  removeAuthor: 'Remove this author',
  addAuthor: 'Add an author',
  bulk: {
    title: 'Edit the selection',
    description_one:
      '{{count}} book selected. Tick the fields to change: their new value is applied to every selected book.',
    description_other:
      '{{count}} books selected. Tick the fields to change: their new value is applied to every selected book.',
    field: 'Field',
    current: 'Now',
    after: 'After',
    mixed: 'Several values',
    newValue: 'New value of {{field}}',
    hint: 'An empty value clears the field on every book. Authors replace the whole list of each book. The title is not editable here.',
    apply_one: 'Apply to {{count}} book',
    apply_other: 'Apply to {{count}} books',
  },
  errors: {
    emptyTitle: 'The title can’t be empty.',
    releaseDate: 'Expected date: YYYY, YYYY-MM or YYYY-MM-DD.',
    lastName: 'The last name is required (a pen name goes in the last name).',
  },
};
