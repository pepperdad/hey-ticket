import { Kysely, sql } from "kysely";
import pLimit from "p-limit";

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

    const availableEmojicount = Math.min(quota, count);

    await Promise.all([
      this.db
        .insertInto("emoji_daily")
        .values({
          user_id: giver,
          sent_count: availableEmojicount,
          received_count: 0,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            sent_count: sql`sent_count + ${availableEmojicount}`,
          })
        )
        .execute(),
      this.db
        .insertInto("emoji_daily")
        .values({
          user_id: receiver,
          sent_count: 0,
          received_count: availableEmojicount,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            received_count: sql`received_count + ${availableEmojicount}`,
          })
        )
        .execute(),
    ]);

    const seasonId = await this.getCurrentSeasonId();
    const seasonData = await this.db
      .selectFrom("emoji_season")
      .select("received_count")
      .where("season_id", "=", seasonId)
      .where("user_id", "=", receiver)
      .executeTakeFirst();

    const seasonReceivedCount = seasonData?.received_count || 0;

    return {
      success: true,
      count: availableEmojicount,
      remaining_quota: quota - availableEmojicount,
      season_received_count: seasonReceivedCount + availableEmojicount,
    };
  }

  async resetDailyEmoji() {
    await this.db
      .updateTable("emoji_daily")
      .set({ sent_count: 0, received_count: 0 })
      .execute();
  }

  async updateDailyEmoji() {
    const dailyData = await this.db
      .selectFrom("emoji_daily")
      .select(["user_id", "sent_count", "received_count"])
      .execute();

    const seasonId = await this.getCurrentSeasonId();

    const limit = pLimit(10); // 최대 10개씩 처리

    const updateDailyDatas = dailyData.map((data) =>
      limit(async () => {
        const { user_id, sent_count, received_count } = data;

        await this.db
          .insertInto("emoji_season")
          .values({
            season_id: seasonId,
            user_id: user_id,
            sent_count: sent_count,
            received_count: received_count,
          })
          .onConflict((oc) =>
            oc.doUpdateSet({
              sent_count: sql`sent_count + ${sent_count}`,
              received_count: sql`received_count + ${received_count}`,
            })
          )
          .execute();
      })
    );

    await Promise.all(updateDailyDatas);
  }

  /**
   * @desc 현재 시즌 데이터를 아카이브
   */
  async archiveSeason() {
    await this.db
      .insertInto("emoji_season_archive")
      .columns(["season_id", "user_id", "sent_count", "received_count"])
      .expression(
        this.db
          .selectFrom("emoji_season")
          .select(["season_id", "user_id", "sent_count", "received_count"])
      )
      .execute();

    await this.db.deleteFrom("emoji_season").execute();

    const seasonId = await this.getCurrentSeasonId();
    const endDate = new Date().toISOString().split("T")[0];
    await this.db
      .updateTable("season_info")
      .set({ end_date: endDate })
      .where("id", "=", seasonId)
      .execute();

    await this.createSeason();
  }

  async getSeasonRanking(nowSeason: boolean, season?: number, userId?: string) {
    const sentQuery = nowSeason
      ? this.db
          .selectFrom("emoji_daily")
          .leftJoin(
            "emoji_season",
            "emoji_daily.user_id",
            "emoji_season.user_id"
          )
          .select([
            "emoji_daily.user_id",
            sql`COALESCE(emoji_daily.sent_count, 0) + COALESCE(emoji_season.sent_count, 0)`.as(
              "total"
            ),
          ])
          .orderBy("total", "desc")
          .limit(5)
      : this.db
          .selectFrom("emoji_season_archive")
          .select(["user_id", sql`sent_count`.as("total")])
          .where("season_id", "=", season!)
          .orderBy("total", "desc")
          .limit(10);

    const receivedQuery = nowSeason
      ? this.db
          .selectFrom("emoji_daily")
          .leftJoin(
            "emoji_season",
            "emoji_daily.user_id",
            "emoji_season.user_id"
          )
          .select([
            "emoji_daily.user_id",
            sql`COALESCE(emoji_daily.received_count, 0) + COALESCE(emoji_season.received_count, 0)`.as(
              "total"
            ),
          ])
          .orderBy("total", "desc")
          .limit(5)
      : this.db
          .selectFrom("emoji_season_archive")
          .select(["user_id", sql`received_count`.as("total")])
          .where("season_id", "=", season!)
          .orderBy("total", "desc")
          .limit(10);

    const userSentQuery = nowSeason
      ? this.db
          .selectFrom("emoji_daily")
          .leftJoin(
            "emoji_season",
            "emoji_daily.user_id",
            "emoji_season.user_id"
          )
          .select(
            sql`COALESCE(emoji_daily.sent_count, 0) + COALESCE(emoji_season.sent_count, 0)`.as(
              "total"
            )
          )
          .where("emoji_daily.user_id", "=", userId!)
      : this.db
          .selectFrom("emoji_season_archive")
          .select(sql`sent_count`.as("total"))
          .where("season_id", "=", season!)
          .where("user_id", "=", userId!);

    const userReceivedQuery = nowSeason
      ? this.db
          .selectFrom("emoji_daily")
          .leftJoin(
            "emoji_season",
            "emoji_daily.user_id",
            "emoji_season.user_id"
          )
          .select(
            sql`COALESCE(emoji_daily.received_count, 0) + COALESCE(emoji_season.received_count, 0)`.as(
              "total"
            )
          )
          .where("emoji_daily.user_id", "=", userId!)
      : this.db
          .selectFrom("emoji_season_archive")
          .select(sql`received_count`.as("total"))
          .where("season_id", "=", season!)
          .where("user_id", "=", userId!);

    const [sent, received, userSent, userReceived] = await Promise.all([
      sentQuery.execute(),
      receivedQuery.execute(),
      userSentQuery.execute(),
      userReceivedQuery.execute(),
    ]);

    return {
      sent,
      received,
      user_sent_count: userSent[0]?.total || 0,
      user_received_count: userReceived[0]?.total || 0,
    };
  }

  async getTodayRanking() {
    const sent = await this.db
      .selectFrom("emoji_daily")
      .select(["user_id", sql`sent_count`.as("total")])
      .orderBy("total", "desc")
      .limit(5)
      .execute();

    const received = await this.db
      .selectFrom("emoji_daily")
      .select(["user_id", sql`received_count`.as("total")])
      .orderBy("total", "desc")
      .limit(5)
      .execute();

    return { sent, received };
  }

  async getAllSeasons() {
    return await this.db
      .selectFrom("season_info")
      .select(["id", "season_name"])
      .orderBy("id", "desc")
      .execute();
  }
}
