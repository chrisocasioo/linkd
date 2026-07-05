import { NativeModule, requireNativeModule } from 'expo';
import { LiveActivityModuleInterface } from './LiveActivity.types';

declare class LiveActivityModule extends NativeModule<{}> implements LiveActivityModuleInterface {
  areActivitiesEnabled(): Promise<boolean>;
  start(payload: import('./LiveActivity.types').CardActivityPayload): Promise<boolean>;
  end(): Promise<void>;
}

export default requireNativeModule<LiveActivityModule>('LiveActivity');
