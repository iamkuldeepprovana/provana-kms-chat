import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ChatSession from "@/lib/models/ChatSession";

// Special route to update all messages in a session (not just append)
export async function POST(req: NextRequest) {
  await dbConnect();
  
  try {
    const body = await req.json();
    const { sessionId, user, messages } = body;
    
    if (!sessionId || !user || !messages) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Find the session and replace all messages
    const session = await ChatSession.findOneAndUpdate(
      { sessionId, user },
      { $set: { messages } },
      { new: true }
    );
    
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(session);
  } catch (error) {
    console.error("Error updating session messages:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
