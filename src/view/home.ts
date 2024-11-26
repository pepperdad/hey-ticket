import {
  AnyHomeTabBlock,
  HomeTabView,
  SlackAPIClient,
} from "slack-cloudflare-workers";
import { Repository } from "../repository";
import {
  Divider,
  Margin,
  MdText,
  RankingData,
  RankingSection,
  Seasons,
  SeasonSelector,
} from "./component";

export class Home {
  private client: SlackAPIClient;
  private repository: Repository;
  private emoji: string;
  private quota: number;

  constructor(
    client: SlackAPIClient,
    repository: Repository,
    emoji: string,
    quota: number
  ) {
    this.client = client;
    this.repository = repository;
    this.emoji = emoji;
    this.quota = quota;
  }

  async generateHomeView(
    userId: string,
    selectedSeasonId?: number
  ): Promise<HomeTabView> {
    const seasons = await this.repository.getAllSeasons();
    selectedSeasonId = selectedSeasonId || seasons[0]?.id;
    const nowSeason = selectedSeasonId === seasons[0]?.id;
    const selectedSeasonName =
      seasons.find((season) => season.id === selectedSeasonId)?.season_name ||
      "현재 시즌";

    const {
      sent: currentSeasonRankingSent,
      received: currentSeasonRankingReceived,
      user_sent_count,
      user_received_count,
    } = await this.repository.getSeasonRanking(
      nowSeason,
      selectedSeasonId,
      userId
    );

    const { sent: todayRankingSent, received: todayRankingReceived } =
      await this.repository.getTodayRanking();

    const remainingQuota = await this.repository.getRemainingQuota(userId);

    const blocks: AnyHomeTabBlock[] = [
      {
        type: "section",
        text: MdText(
          `*“티켓으로 만드는 행복한 순간들”*\n \n매일 주고받는 부탁, 고마움, 그리고 미안함의 감정들이 익숙해지지 않도록, 작은 ${this.emoji} 하나로 누군가의 하루를 환하게 밝혀보세요.\n고마운 사람을 멘션하고 따뜻한 메시지와 함께 ${this.emoji}를 전해보세요.`
        ),
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_${this.emoji}은 하루에 최대 *${this.quota}개* 까지 보낼 수 있어요!_`,
          },
        ],
      },

      Margin,
      Margin,
      Margin,

      {
        type: "section",
        text: MdText(`*🏆 ${selectedSeasonName} 랭킹*`),
        accessory: SeasonSelector(
          seasons as Seasons[],
          selectedSeasonName,
          selectedSeasonId
        ),
      },
      Divider,

      {
        type: "section",
        fields: [MdText("*보낸 갯수*"), MdText("*받은 갯수*")],
      },
      ...RankingSection(
        currentSeasonRankingSent as RankingData[],
        currentSeasonRankingReceived as RankingData[],
        this.emoji
      ),
      Divider,

      Margin,
      Margin,
    ];

    if (nowSeason) {
      blocks.push(
        {
          type: "section",
          text: MdText("*🎉 오늘의 랭킹*"),
        },
        Divider,

        {
          type: "section",
          fields: [MdText("*보낸 갯수*"), MdText("*받은 갯수*")],
        },
        ...RankingSection(
          todayRankingSent as RankingData[],
          todayRankingReceived as RankingData[],
          this.emoji
        ),
        Divider
      );
    }

    blocks.push(
      Margin,
      Margin,
      {
        type: "section",
        text: MdText(`*<@${userId}>의 정보*`),
      },
      {
        type: "section",
        text: MdText(
          `*${selectedSeasonName}* 에 ${this.emoji}를 *${user_sent_count}개* 보내고, *${user_received_count}개* 받았어요.`
        ),
      }
    );

    if (nowSeason) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_오늘은 ${this.emoji}를 *${remainingQuota}개* 더 보낼 수 있어요._`,
          },
        ],
      });
    }

    return {
      type: "home",
      blocks,
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
