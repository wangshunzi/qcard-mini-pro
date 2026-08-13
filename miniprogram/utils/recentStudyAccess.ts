export interface RecentStudyAccessCandidate {
  isUnlocked?: boolean;
  userStudyProgress?: {
    lastStudiedAt?: string;
  };
}

/** 与 Client 最近学习列表保持一致：有历史但当前未解锁的公共卡包视为 VIP 权益已到期。 */
export function isExpiredVipStudyAccess(
  cardPack: RecentStudyAccessCandidate,
  isPrivate: boolean,
) {
  return Boolean(
    !isPrivate &&
    cardPack.userStudyProgress?.lastStudiedAt &&
    !cardPack.isUnlocked,
  );
}
