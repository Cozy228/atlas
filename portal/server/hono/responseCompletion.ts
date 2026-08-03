export function trackResponseCompletion(response: Response, onComplete: () => void): Response {
  if (!response.body) {
    onComplete();
    return response;
  }

  const reader = response.body.getReader();
  let completed = false;
  const complete = () => {
    if (completed) return;
    completed = true;
    onComplete();
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          complete();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        complete();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        complete();
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
