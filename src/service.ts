import { SlackAPIClient } from "slack-cloudflare-workers";
import { Repository } from "./repository";
import { countEmojis, extractUniqueMentionedUsers } from "./util";

export class SlackMessageService {
  private client: SlackAPIClient;
  private emoji: string;
  private repository: Repository;

  constructor(client: SlackAPIClient, emoji: string, repository: Repository) {
    this.client = client;
    this.emoji = emoji;
    this.repository = repository;
  }

  /**
   * @desc 메시지를 처리하여 멘션된 사용자들에게 이모지를 보냅니다.
   */
  async handleMessage(
    channel: string,
    text: string,
    user: string,
    thread_ts?: string
  ) {
    if (!text.includes(this.emoji)) return;

    const count = countEmojis(text, this.emoji);

    const users = extractUniqueMentionedUsers(text);
    if (users.length === 0) return;

    for (const mentionedUser of users) {
      if (user === mentionedUser) continue;

      const { success, sent_count, remaining_quota } =
        await this.repository.sent(user, mentionedUser, count);

      if (!success) {
        await this.client.chat.postEphemeral({
          channel,
          text: `오늘은 ${this.emoji}이 모두 소진되었어요! 내일 더 보낼 수 있어요. 😊`,
          user,
          thread_ts,
        });
        return;
      }

      await this.client.chat.postEphemeral({
        channel,
        text: `<@${mentionedUser}>님에게 ${this.emoji}를 ${sent_count}개 보냈어요! 오늘 남은${this.emoji}는 ${remaining_quota}개에요.`,
        user,
        thread_ts,
      });
      await this.client.chat.postEphemeral({
        channel,
        text: `<@${user}>님으로부터 ${this.emoji}를 ${sent_count}개 받았어요!`,
        user: mentionedUser,
        thread_ts,
      });
    }
  }
}
