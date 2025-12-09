import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user: me }, { status: 200 });
}


