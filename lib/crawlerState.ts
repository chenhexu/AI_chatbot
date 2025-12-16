// In-memory crawler state (in production, use Redis or database)
let crawlerState: {
  isRunning: boolean;
  pagesCrawled: number;
  filesDownloaded: number;
  linksFound: number;
  errors: number;
  currentUrl?: string;
  queueLength?: number;
} = {
  isRunning: false,
  pagesCrawled: 0,
  filesDownloaded: 0,
  linksFound: 0,
  errors: 0,
};

let crawlerProcess: { kill: () => void } | null = null;

export function setCrawlerState(state: Partial<typeof crawlerState>) {
  crawlerState = { ...crawlerState, ...state };
}

export function getCrawlerState() {
  return crawlerState;
}

export function setCrawlerProcess(process: { kill: () => void } | null) {
  crawlerProcess = process;
}

export function getCrawlerProcess() {
  return crawlerProcess;
}

