import { SlackAPIClient } from "slack-cloudflare-workers";
import { countEmojis, extractUniqueMentionedUsers } from "./util";

export class SlackMessageService {
  private client: SlackAPIClient;
  private emoji: string;

  constructor(client: SlackAPIClient, emoji: string) {
    this.client = client;
    this.emoji = emoji;
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

      await this.client.chat.postEphemeral({
        channel,
        text: `<@${mentionedUser}>에게 ${this.emoji}를 ${count}개 보냈어요!`,
        user,
        thread_ts,
      });
    }
  }
}
