export interface ViewEntry {
  id: string;
  dataType: string;
  title: string;
  summary: string;
  rawData: unknown;
  aiResponse: string;
  createdAt: number;
  expiresAt: number;
}
