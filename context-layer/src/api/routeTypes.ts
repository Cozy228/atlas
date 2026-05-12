import type { ApiErrorResponse } from "@atlas/schema";

export type ApiResponse<TBody> = {
  status: number;
  body: TBody;
};

export function errorResponse(
  status: number,
  code: ApiErrorResponse["error"]["code"],
  message: string,
): ApiResponse<ApiErrorResponse> {
  return {
    status,
    body: {
      error: {
        code,
        message,
      },
    },
  };
}
