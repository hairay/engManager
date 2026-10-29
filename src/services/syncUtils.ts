/**
 * 雙向智慧合併 (Smart Merge) 與時間戳衝突解決
 */
export class SyncUtils {
  /**
   * 依 ID 智慧合併兩份清單，考慮刪除墓碑與時間戳（最新修改優先）
   */
  public static mergeByIdSmart<T extends { id: string; updatedAt?: string; createdAt?: string }>(
    localList: T[],
    cloudList: T[],
    deletedIds: Set<string>
  ): T[] {
    const cloudMap = new Map(cloudList.map((item) => [item.id, item]));
    const localMap = new Map(localList.map((item) => [item.id, item]));
    const result: T[] = [];

    // 先處理本機項目
    for (const local of localList) {
      if (deletedIds.has(local.id)) continue;
      const cloud = cloudMap.get(local.id);
      if (cloud) {
        result.push(this.pickByTimestamp(local, cloud));
      } else {
        result.push(local);
      }
    }

    // 加入雲端有而本機沒有（且未被刪除）的項目
    for (const cloud of cloudList) {
      if (deletedIds.has(cloud.id)) continue;
      if (!localMap.has(cloud.id)) {
        result.push(cloud);
      }
    }

    return result;
  }

  private static pickByTimestamp<T extends { id: string; updatedAt?: string; createdAt?: string }>(
    local: T,
    cloud: T
  ): T {
    const localTs = local.updatedAt || local.createdAt || '';
    const cloudTs = cloud.updatedAt || cloud.createdAt || '';
    return localTs >= cloudTs ? local : cloud;
  }

  public static isSameList<T extends { id: string }>(listA: T[], listB: T[]): boolean {
    if (listA.length !== listB.length) return false;

    const sortedA = [...listA].sort((a, b) => a.id.localeCompare(b.id));
    const sortedB = [...listB].sort((a, b) => a.id.localeCompare(b.id));
    const strA = JSON.stringify(sortedA);
    const strB = JSON.stringify(sortedB);
    return strA === strB;
  }
}
