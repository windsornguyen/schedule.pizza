const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    return null;
  }

  return username;
}
