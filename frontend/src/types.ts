export interface MobilePlan {
  id: number;
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  calls: string | null;
  sms: string | null;
  network: string | null;
  score: number | null;
  url: string | null;
  createdAt: string; // Les dates sont des chaînes de caractères lors de la sérialisation JSON
  updatedAt: string;
} 