import type { Page } from 'playwright';

export type MobileNetwork = 'Orange' | 'SFR' | 'Bouygues Telecom' | 'Free';
export type ScrapeMode = 'http' | 'browser';

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

export interface OperatorDefinition {
  name: string;
  url: string;
  mode: ScrapeMode;
  networks: readonly MobileNetwork[];
  minOffers: number;
  legacyNames?: readonly string[];
  pdfUrl?: string;
  findPdfUrl?: (page: Page) => Promise<string | null>;
  defaultSimPrice?: number;
  htmlScrapeFunction?: (html: string, url: string) => ScrapedPlan[] | Promise<ScrapedPlan[]>;
  scrapeFunction: (page: Page) => Promise<ScrapedPlan[]>;
}

export type ScraperConfig = OperatorDefinition;

export type ScrapeOutcomeStatus = 'success' | 'partial' | 'failed' | 'blocked';

export interface ScrapeOutcome {
  operator: string;
  status: ScrapeOutcomeStatus;
  offers: number;
  durationMs: number;
  mode: ScrapeMode;
  attempts: number;
  error?: string;
  purgeSkipped?: boolean;
}

export interface ScrapeRunSummary {
  success: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  outcomes: ScrapeOutcome[];
}
