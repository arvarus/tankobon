// The home page, shown when the app starts.
export default {
  title: 'Home',
  welcome: 'Welcome {{nickname}}',
  secondChance: {
    title: 'Give them a second chance',
    empty: 'No poorly rated books yet.',
    shuffle: 'Pick other books',
  },
  suggestions: {
    title: 'Something to read',
    shuffle: 'Pick other books',
    empty: 'No unread book in the library.',
  },
  continueReading: 'Continue reading',
  continueReadingEmpty: 'No book started yet.',
  scrollPrevious: 'Scroll left',
  scrollNext: 'Scroll right',
  resetProgress: {
    action: 'Remove from this list',
    title: 'Remove from “Continue reading”?',
    message: 'This resets the reading of “{{title}}”: it goes back to 0 %. If you already finished it, it keeps its “Read” tag.',
    confirm: 'Reset reading',
  },
  continueReadingPage: 'Page {{page}} / {{total}}',
  recentlyAdded: 'Recently added',
  recentlyAddedEmpty: 'No book in the library yet.',
  openBook: 'Open {{title}}',
  favorites: {
    title: 'Rediscover your favorites',
    rating: '{{rating}} / 5',
    empty: 'No rated book yet.',
    shuffle: 'Pick other books',
  },
};
