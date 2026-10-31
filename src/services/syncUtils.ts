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

    // 先以 Date.parse 數值比較 ISO 時間戳，避免「2026-01-01T00:00:00Z」與
    // 「2026-01-01T00:00:00+00:00」等格式差異造成字串字典序誤判 (Z > + 因此勝出)。
    const localNum = Date.parse(localTs);
    const cloudNum = Date.parse(cloudTs);
    if (!Number.isNaN(localNum) && !Number.isNaN(cloudNum)) {
      // 同一時間點 (僅格式差異) 維持「平手保本機」語意
      return localNum === cloudNum ? local : (localNum > cloudNum ? local : cloud);
    }
    // 任一方非 ISO 格式時，退回原有的字串比較 (平手保本機)
    return localTs >= cloudTs ? local : cloud;
  }

  /**
   * 逐欄位比較兩份清單內容是否一致（與物件屬性順序無關，避免本機與雲端
   * normalize 產生不同 key 順序時造成假差異而重複寫入 localStorage）。
   */
  public static isSameList<T extends { id: string }>(listA: T[], listB: T[]): boolean {
    if (listA.length !== listB.length) return false;
    const canonical = (item: T): string =>
      JSON.stringify(Object.entries(item).sort((a, b) => a[0].localeCompare(b[0])));
    const mapB = new Map(listB.map((item) => [item.id, canonical(item)]));
    return listA.every((item) => mapB.get(item.id) === canonical(item));
  }
}
