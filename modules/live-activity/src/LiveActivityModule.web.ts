import { LiveActivityModuleInterface } from './LiveActivity.types';

// Live Activities are an iOS-only concept — no-op everywhere else.
const stub: LiveActivityModuleInterface = {
  async areActivitiesEnabled() {
    return false;
  },
  async isRunning() {
    return false;
  },
  async start() {
    return false;
  },
  async end() {},
};

export default stub;
