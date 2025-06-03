export class SearchService {
  constructor(settings: any) {
    this.settings = settings;
  }

  settings: any;

  searchWeb = jest.fn().mockImplementation((query: string) => {
    return Promise.resolve([
      { title: 'Mock search result 1', link: 'https://example.com/1', snippet: 'This is a mock search result.' },
      { title: 'Mock search result 2', link: 'https://example.com/2', snippet: 'This is another mock search result.' }
    ]);
  });
}
