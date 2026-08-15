import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RoomCode, MatchRoom } from "./matchServer.js";

export interface RoomStore {
  save(roomCode: RoomCode, room: MatchRoom): void | Promise<void>;
  remove(roomCode: RoomCode): void | Promise<void>;
  load(): Record<RoomCode, MatchRoom> | Promise<Record<RoomCode, MatchRoom>>;
}

export interface FileRoomStoreOptions {
  readonly path: string;
}

export class FileRoomStore implements RoomStore {
  private readonly path: string;

  constructor(options: FileRoomStoreOptions) {
    this.path = options.path;
  }

  save(roomCode: RoomCode, room: MatchRoom): void {
    const data = this.readData();
    data[roomCode] = room as unknown as Record<string, unknown>;
    this.writeData(data);
  }

  remove(roomCode: RoomCode): void {
    const data = this.readData();
    delete data[roomCode];
    this.writeData(data);
  }

  load(): Record<RoomCode, MatchRoom> {
    if (!existsSync(this.path)) return {};
    const text = readFileSync(this.path, "utf8");
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<RoomCode, MatchRoom>;
  }

  private readData(): Record<RoomCode, Record<string, unknown>> {
    return (this.load() as unknown) as Record<RoomCode, Record<string, unknown>>;
  }

  private writeData(data: Record<RoomCode, Record<string, unknown>>): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(data, null, 2));
  }
}

export class InMemoryRoomStore implements RoomStore {
  private rooms: Record<RoomCode, MatchRoom> = {};

  save(roomCode: RoomCode, room: MatchRoom): void {
    this.rooms[roomCode] = room;
  }

  remove(roomCode: RoomCode): void {
    delete this.rooms[roomCode];
  }

  load(): Record<RoomCode, MatchRoom> {
    return this.rooms;
  }
}
