export class WebScraperService {
  constructor(settings: any) {
    this.settings = settings;
  }

  settings: any;

  scrapeUrl = jest.fn().mockImplementation((url: string) => {
    return Promise.resolve({
      title: 'Mock webpage title',
      content: 'This is mock webpage content scraped from the provided URL.',
      url: url
    });
  });
}
