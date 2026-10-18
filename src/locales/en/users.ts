// The users of the app: the sidebar menu, the new-user dialog and the profile page.
export default {
  menu: {
    label: 'User menu, signed in as {{nickname}}',
    switchTo: 'Switch to {{nickname}}',
    current: 'Current user',
    editProfile: 'My profile',
    add: 'Add a user…',
    heading: 'Users',
  },
  newUser: {
    title: 'New user',
    description: 'The new user shares the library but starts with their own ratings, lists, history and settings.',
    nickname: 'Nickname',
    create: 'Create and switch',
  },
  profile: {
    title: 'My profile',
    nickname: 'Nickname',
    nicknameHint: 'No password: anyone using the app can switch to any user.',
    save: 'Save',
    saved: 'Saved.',
    picture: 'Profile picture',
    chooseImage: 'Choose an image…',
    removeImage: 'Remove the image',
    imageError: 'This image can’t be used.',
    shared: 'The library, its metadata and its organization are shared with the other users. Your ratings, tags, progress, reading lists, statistics, achievements and settings (reading, display, language, home page…) are yours alone.',
    history: {
      title: 'Reading history',
      empty: 'Nothing yet: the time you spend reading a book of the library will be listed here.',
      removedBook: 'Book removed from the library',
      clear: 'Clear the history',
      confirmTitle: 'Clear the reading history?',
      confirmMessage: 'The list of the books you read and the reading time of the statistics are deleted. Your books, progress, ratings and finished books stay.',
      confirmAction: 'Clear',
    },
    sharedSettings: 'The settings of the library (folders, organization, metadata sources, updates) are shared by every user.',
  },
};
