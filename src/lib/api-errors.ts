import { NextResponse } from "next/server";

import { InvalidTransitionError } from "@/lib/sessionTransitions";

export function transitionErrorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  throw error;
}
