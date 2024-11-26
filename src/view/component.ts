import { DividerBlock, SectionBlock } from "slack-cloudflare-workers";

export interface RankingData {
  user_id: string;
  total: number;
}

export const RankingSection = (
  leftRanking: RankingData[],
  rightRanking: RankingData[],
  emoji: string
): SectionBlock[] => {
  return Array(Math.max(leftRanking.length, rightRanking.length))
    .fill(null)
    .map((_, index) => ({
      type: "section",
      fields: [
        Rank(leftRanking, index, emoji),
        Rank(rightRanking, index, emoji),
      ],
    }));
};

type MrkdwnElement = {
  type: "mrkdwn";
  text: string;
};

export const Rank = (
  rankingData: RankingData[],
  index: number,
  emoji: string
): MrkdwnElement => {
  const entry = rankingData[index];

  if (!entry) {
    return {
      type: "mrkdwn",
      text: " ",
    };
  }

  const { total, user_id } = entry;

  return {
    type: "mrkdwn",
    text: `*${String(index + 1).padStart(2, " ")}위* *${emoji} ${String(
      total
    ).padStart(2, " ")}개* - <@${user_id}>`,
  };
};

export const MdText = (text: string): MrkdwnElement => {
  return {
    type: "mrkdwn",
    text,
  };
};

export const Divider: DividerBlock = {
  type: "divider",
};

export const Margin: SectionBlock = {
  type: "section",
  text: { type: "mrkdwn", text: " " },
};

export interface Seasons {
  id: number;
  season_name: string;
}

export const SeasonSelector = (
  seasons: Seasons[],
  selectedSeasonName: string,
  selectedSeasonId?: number
): SectionBlock["accessory"] => ({
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
    value: season.id.toString(),
  })),
  initial_option: {
    text: {
      type: "plain_text",
      text: selectedSeasonName || "시즌 선택",
    },
    value: selectedSeasonId?.toString() || "",
  },
});
