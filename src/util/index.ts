export function countEmojis(text: string, emoji: string) {
  const regex = new RegExp(emoji, "g");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function extractUniqueMentionedUsers(text: string) {
  const mentionRegex = /<@(\w+)>/g;
  const matches = [...text.matchAll(mentionRegex)];
  const mentionedUsers = matches.map((match) => match[1]);

  return [...new Set(mentionedUsers)];
}
