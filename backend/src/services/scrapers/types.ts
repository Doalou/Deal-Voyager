import type { Page } from 'puppeteer';

export interface ScrapedPlan {
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  calls?: string;
  simPrice?: number;
  activationPrice?: number;
  cancellationPrice?: number;
  network?: string;
  networkGeneration?: string;
  dataEuGb?: number;
  url?: string;
}

export interface PdfFees {
  simPrice: number | null;
  activationPrice: number | null;
  cancellationPrice: number | null;
}

export interface ScraperConfig {
  name: string;
  url: string;
  pdfUrl?: string;
  findPdfUrl?: (page: Page) => Promise<string | null>;
  defaultSimPrice?: number;
  scrapeFunction: (page: Page) => Promise<ScrapedPlan[]>;
}
