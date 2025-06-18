import mongoose, { Schema, Document, models } from "mongoose";

export interface IMessage {
  role: "user" | "ai";
  content: string;
}

export interface IChatSession extends Document {
  sessionId: string;
  user: string;
  title: string;
  messages: IMessage[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "ai"], required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>({
  sessionId: { type: String, required: true, unique: true },
  user: { type: String, required: true },
  title: { type: String, required: true },
  messages: { type: [MessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default models.ChatSession ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
