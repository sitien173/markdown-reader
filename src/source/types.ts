export interface Source { read(): Promise<string>; readonly baseUrl: string; }
