import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server.edge";

const STREAM_TIMEOUT = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT);

  try {
    const stream = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          if (!controller.signal.aborted) {
            console.error(error);
          }
          responseStatusCode = 500;
        },
      }
    );

    responseHeaders.set("Content-Type", "text/html");

    return new Response(stream, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
