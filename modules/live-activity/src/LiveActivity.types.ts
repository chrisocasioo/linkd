export interface CardActivityPayload {
  cardId: string;
  name: string;
  title: string;
  company: string;
  accentColor: string;
  onlineUrl: string;
  offlineValue: string;
}

export interface LiveActivityModuleInterface {
  areActivitiesEnabled(): Promise<boolean>;
  start(payload: CardActivityPayload): Promise<boolean>;
  end(): Promise<void>;
}
