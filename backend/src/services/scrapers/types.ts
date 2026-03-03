import type { Page } from 'puppeteer';

export interface ScrapedPlan {
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  calls?: string;
  simPrice?: number;
  network?: string;
  url?: string;
}

export interface ScraperConfig {
  name: string;
  url: string;
  scrapeFunction: (page: Page) => Promise<ScrapedPlan[]>;
}
