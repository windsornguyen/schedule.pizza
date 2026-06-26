const CF_CONNECTING_IP_HEADER = "CF-Connecting-IP";

type ClientIpHashResult =
  | { code: "client_ip_unavailable" }
  | { code: "ok"; ipHash: string };

export async function readCloudflareClientIpHash(
  request: Request,
): Promise<ClientIpHashResult> {
  const clientIp = request.headers.get(CF_CONNECTING_IP_HEADER)?.trim();

  if (clientIp === undefined || clientIp.length === 0) {
    return { code: "client_ip_unavailable" };
  }

  const bytes = new TextEncoder().encode(clientIp);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return {
    code: "ok",
    ipHash: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
