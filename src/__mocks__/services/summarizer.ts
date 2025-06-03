import { SummaryLevel } from '../../views/summary-view';

export class SummarizerService {
  constructor(settings: any) {
    this.settings = settings;
  }

  settings: any;

  summarize = jest.fn().mockImplementation((content: string, level: SummaryLevel, removeTitle: boolean = true) => {
    return Promise.resolve(`This is a mock summary at ${level} level.`);
  });
}
