import { Kysely, sql } from "kysely";

export class Repository {
  private db: Kysely<Database>;
  private dailyLimit: number;

  constructor(db: Kysely<Database>, dailyLimit: string) {
    this.db = db;
    this.dailyLimit = +dailyLimit;
  }

  async getRemainingQuota(user: string): Promise<number> {
    const giverData = await this.db
      .selectFrom("emoji_daily")
      .select("sent_count")
      .where("user_id", "=", user)
      .executeTakeFirst();

    const sentCount = giverData?.sent_count || 0;
    const remainingQuota = this.dailyLimit - sentCount;

    return Math.max(0, remainingQuota);
  }

  /**
   * @desc 사용자에게 이모지를 보냅니다.
   */
  async sent(giver: string, receiver: string, count: number) {
    const quota = await this.getRemainingQuota(giver);
    if (quota === 0) {
      return { suceess: false };
    }
    count = Math.min(quota, count);

    await this.db
      .insertInto("emoji_daily")
      .values({ user_id: giver, sent_count: count, received_count: 0 })
      .onConflict((oc) =>
        oc
          .column("user_id")
          .doUpdateSet({ sent_count: sql`sent_count + ${count}` })
      )
      .execute();
    await this.db
      .insertInto("emoji_daily")
      .values({ user_id: receiver, sent_count: 0, received_count: count })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({
          received_count: sql`received_count + ${count}`,
        })
      )
      .execute();

    return { success: true, sent_count: count, remaining_quota: quota - count };
  }
}
