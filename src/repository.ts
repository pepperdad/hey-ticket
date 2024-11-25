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

  async getCurrentSeasonId() {
    const seasonInfo = await this.db
      .selectFrom("season_info")
      .select("id")
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirst();

    let seasonId = seasonInfo?.id;
    if (!seasonId) {
      seasonId = await this.createSeason();
    }

    return seasonId;
  }

  async createSeason(): Promise<number> {
    const seasonName = `Season ${new Date().toISOString().slice(0, 10)}`;
    const startDate = new Date().toISOString().split("T")[0];

    await this.db
      .insertInto("season_info")
      .values({
        season_name: seasonName,
        start_date: startDate,
      })
      .execute();

    const seasonId = await this.getCurrentSeasonId();

    return seasonId;
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

    // daily 테이블에 추가
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

    // season 테이블에 추가
    const seasonId = await this.getCurrentSeasonId();
    await this.db
      .insertInto("emoji_season")
      .values({
        season_id: seasonId,
        user_id: giver,
        sent_count: count,
        received_count: 0,
      })
      .onConflict((oc) =>
        oc
          .columns(["season_id", "user_id"])
          .doUpdateSet({ sent_count: sql`sent_count + ${count}` })
      )
      .execute();
    await this.db
      .insertInto("emoji_season")
      .values({
        season_id: seasonId,
        user_id: receiver,
        sent_count: 0,
        received_count: count,
      })
      .onConflict((oc) =>
        oc
          .columns(["season_id", "user_id"])
          .doUpdateSet({ received_count: sql`received_count + ${count}` })
      )
      .execute();

    return { success: true, sent_count: count, remaining_quota: quota - count };
  }

  async resetEmojiDaily() {
    await this.db
      .updateTable("emoji_daily")
      .set({ sent_count: 0, received_count: 0 })
      .execute();
  }
}
