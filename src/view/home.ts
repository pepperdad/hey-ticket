import { SlackAPIClient } from "slack-cloudflare-workers";
import { Repository } from "../repository";

export class Home {
  private client: SlackAPIClient;
  private repository: Repository;

  constructor(client: SlackAPIClient, repository: Repository) {
    this.client = client;
    this.repository = repository;
  }

  async generateHomeView(
    userId: string,
    selectedSeasonId?: number
  ): Promise<any> {
    const seasons = await this.repository.getAllSeasons();
    selectedSeasonId = selectedSeasonId || seasons[0]?.id;
    const nowSeason = selectedSeasonId === seasons[0]?.id;
    const selectedSeasonName =
      seasons.find((season) => season.id === selectedSeasonId)?.season_name ||
      "현재 시즌";

    const {
      sent: currentSeasonRankingSent,
      received: currentSeasonRankingReceived,
    } = await this.repository.getSeasonRanking(nowSeason, selectedSeasonId);

    const { sent: todayRankingSent, received: todayRankingReceived } =
      await this.repository.getTodayRanking();

    const { seasonSent, seasonReceived, dailyRemaining } =
      await this.repository.getUserInfo(userId);

    return {
      type: "home",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🎯 시즌을 선택하세요.",
          },
          accessory: {
            type: "static_select",
            action_id: "select_season",
            placeholder: {
              type: "plain_text",
              text: "시즌 선택",
            },
            options: seasons.map((season) => ({
              text: {
                type: "plain_text",
                text: season.season_name,
              },
              value: season?.id?.toString(),
            })),
            initial_option: {
              text: {
                type: "plain_text",
                text: selectedSeasonName || "시즌 선택",
              },
              value: selectedSeasonId?.toString() || "",
            },
          },
        },
        {
          type: "divider",
        },
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🏆 ${selectedSeasonName || "현재 시즌"} 랭킹`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*🎟️ 받은 갯수 랭킹*",
            },
            {
              type: "mrkdwn",
              text: "*🎟️ 보낸 갯수 랭킹*",
            },
          ],
        },
        ...Array(
          Math.max(
            currentSeasonRankingReceived.length,
            currentSeasonRankingSent.length
          )
        )
          .fill(null)
          .map((_, index) => ({
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: currentSeasonRankingReceived[index]
                  ? `*${index + 1}위* <@${
                      currentSeasonRankingReceived[index].user_id
                    }> - 🎟️ *${currentSeasonRankingReceived[index].total}개*`
                  : " ",
              },
              {
                type: "mrkdwn",
                text: currentSeasonRankingSent[index]
                  ? `*${index + 1}위* <@${
                      currentSeasonRankingSent[index].user_id
                    }> - 🎟️ *${currentSeasonRankingSent[index].total}개*`
                  : " ",
              },
            ],
          })),
        {
          type: "divider",
        },

        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔥 오늘의 랭킹",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*🎟️ 보낸 개수 랭킹*",
            },
            {
              type: "mrkdwn",
              text: "*🎟️ 받은 개수 랭킹*",
            },
          ],
        },
        ...Array(Math.max(todayRankingSent.length, todayRankingReceived.length))
          .fill(null)
          .map((_, index) => ({
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: todayRankingSent[index]
                  ? `*${index + 1}위* <@${
                      todayRankingSent[index].user_id
                    }> - 🎟️ *${todayRankingSent[index].total}개*`
                  : " ", // 빈 칸으로 채우기
              },
              {
                type: "mrkdwn",
                text: todayRankingReceived[index]
                  ? `*${index + 1}위* <@${
                      todayRankingReceived[index].user_id
                    }> - 🎟️ *${todayRankingReceived[index].total}개*`
                  : " ",
              },
            ],
          })),
        {
          type: "divider",
        },

        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${userId}>의 정보`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `
                지금까지 🎟️를 *${seasonSent}개* 보내고, *${seasonReceived}개* 받았어요.\n오늘은 🎟️를 *x${dailyRemaining}개* 더 보낼 수 있어요.
              `,
          },
        },
      ],
    };
  }

  async updateHomeView(userId: string, selectedSeasonId?: number) {
    const view = await this.generateHomeView(userId, selectedSeasonId);

    await this.client.views.publish({
      user_id: userId,
      view,
    });
  }
}
