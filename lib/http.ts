import { NextRequest, NextResponse } from "next/server";

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "") {
    super(message);
  }
}

// Same envelope as the Express API: clients read `error.message`.
export function handle<C = unknown>(
  fn: (req: NextRequest, ctx: C) => Promise<Response>
) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              message: e.message,
              code: e.code || (e.status === 500 ? "server_error" : "request_error")
            }
          },
          { status: e.status }
        );
      }
      console.error(e);
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Something went wrong. Please try again.",
            code: "server_error"
          }
        },
        { status: 500 }
      );
    }
  };
}
