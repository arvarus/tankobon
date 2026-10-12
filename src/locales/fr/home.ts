import type en from '../en/home';
import type { Translation } from '../types';

const home: Translation<typeof en> = {
  title: 'Accueil',
  continueReading: 'Reprendre la lecture',
  continueReadingPage: 'Page {{page}} / {{total}}',
};

export default home;
