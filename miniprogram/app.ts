import { sessionStore } from "./stores/session";
import { mediaCoordinator } from "./services/MediaCoordinator";
import { logger } from "./utils/logger";
import { flushStudyReports } from "./stores/studyReportQueue";

App({
  globalData: {
    sessionStore,
  },
  onLaunch() {
    sessionStore.hydrate();
    void flushStudyReports();
  },
  onShow() {
    void flushStudyReports();
  },
  onHide() {
    mediaCoordinator.pauseAll();
  },
  onError(message) {
    logger.error("小程序运行时异常", { message });
  },
  onUnhandledRejection(result) {
    logger.error("未处理的 Promise 异常", {
      reason: String(result.reason),
    });
  },
});
