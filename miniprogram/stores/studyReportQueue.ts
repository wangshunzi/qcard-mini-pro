import { recordCardStudy } from "../services/cardPack";
import { ApiError } from "../services/http";
import { createRequestId } from "../utils/requestId";
import { sessionStore } from "./session";

const STORAGE_KEY = "qcard.study-report-queue.v1";
const MAX_QUEUE_SIZE = 100;

interface StudyReport {
  requestId: string;
  userId: string;
  cardPackId: string;
  cardId: string;
  studyTime: number;
  createdAt: number;
}

let flushing = false;

function readQueue(): StudyReport[] {
  const value = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is StudyReport =>
      !!item &&
      typeof item.requestId === "string" &&
      typeof item.userId === "string" &&
      typeof item.cardPackId === "string" &&
      typeof item.cardId === "string" &&
      Number.isFinite(item.studyTime),
  );
}

function writeQueue(queue: StudyReport[]) {
  if (queue.length) wx.setStorageSync(STORAGE_KEY, queue.slice(-MAX_QUEUE_SIZE));
  else wx.removeStorageSync(STORAGE_KEY);
}

export function enqueueStudyReport(
  cardPackId: string,
  cardId: string,
  studyTime: number,
) {
  const userId = sessionStore.getState()?.user.id;
  if (!userId || !cardPackId || !cardId) return;
  const report: StudyReport = {
    requestId: createRequestId(),
    userId,
    cardPackId,
    cardId,
    studyTime: Math.min(3600, Math.max(1, Math.round(studyTime))),
    createdAt: Date.now(),
  };
  writeQueue([...readQueue(), report]);
  void flushStudyReports();
}

export async function flushStudyReports() {
  if (flushing) return;
  const session = sessionStore.getState();
  if (!session) return;
  flushing = true;
  try {
    while (sessionStore.getState()?.user.id === session.user.id) {
      const queue = readQueue();
      const index = queue.findIndex((item) => item.userId === session.user.id);
      if (index < 0) break;
      const report = queue[index];
      try {
        await recordCardStudy(
          report.cardPackId,
          report.cardId,
          report.studyTime,
          report.requestId,
        );
        queue.splice(index, 1);
        writeQueue(queue);
      } catch (error) {
        if (
          error instanceof ApiError &&
          [4001, 4104, 4105].includes(error.code)
        ) {
          break;
        }
        if (
          error instanceof ApiError &&
          error.code !== -1 &&
          error.code !== 429 &&
          error.code < 500
        ) {
          queue.splice(index, 1);
          writeQueue(queue);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
