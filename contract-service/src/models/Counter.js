// src/models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "YYYYDDD"
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "counters" }
);

export default mongoose.model("Counter", counterSchema);