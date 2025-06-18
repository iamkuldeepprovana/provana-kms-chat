import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ChatSession from "@/lib/models/ChatSession";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const user = searchParams.get("user");
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const session = await ChatSession.findOne({ sessionId, user });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(session);
  } else if (user) {
    const sessions = await ChatSession.find({ user }).sort({ createdAt: -1 });
    return NextResponse.json(sessions);
  }
  return NextResponse.json({ error: "Missing user or sessionId" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const { user, title, messages, sessionId } = body;
  // Use provided sessionId if present, otherwise generate a new one
  const sessionIdToUse = sessionId || uuidv4();
  const session = await ChatSession.create({
    sessionId: sessionIdToUse,
    user,
    title: title || (messages?.[0]?.content ?? "Untitled"),
    messages: messages || [],
  });
  return NextResponse.json(session);
}

export async function PUT(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const { sessionId, user, message } = body;
  const session = await ChatSession.findOneAndUpdate(
    { sessionId, user },
    { $push: { messages: message } },
    { new: true }
  );
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}
