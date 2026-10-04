import { Buffer } from 'node:buffer';
import sqlite3 from 'sqlite3';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver, WRITES_IDX_MAP, copyCheckpoint, getCheckpointId,
  type Checkpoint, type CheckpointListOptions, type CheckpointMetadata,
  type CheckpointTuple, type ChannelVersions, type PendingWrite,
} from '@langchain/langgraph-checkpoint';

type CheckpointRow = {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string;
  schema_version: number;
  checkpoint_type: string;
  checkpoint_blob: Buffer;
  metadata_type: string;
  metadata_blob: Buffer;
};
type WriteRow = { task_id: string; channel: string; value_type: string; value_blob: Buffer };

function boundedId(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > 180 || (!allowEmpty && !value) || /[\x00-\x1f]/.test(value)) {
    throw new Error(`Invalid graph checkpoint ${label}.`);
  }
  return value;
}

/** SQLite backed LangGraph saver. The graph must pass only sanitized, bounded state. */
export class SqliteGraphCheckpointer extends BaseCheckpointSaver {
  private readonly db: sqlite3.Database;
  private readonly ready: Promise<void>;

  constructor(dbPath: string, private readonly onCheckpoint?: (checkpoint: { id: string; step: number; source: string }) => Promise<void>) {
    super();
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.run('PRAGMA foreign_keys = ON');
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (error) => error ? reject(error) : resolve());
    });
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => error ? reject(error) : resolve((rows ?? []) as T[]));
    });
  }

  private configParts(config: RunnableConfig) {
    return {
      threadId: boundedId(config.configurable?.thread_id, 'thread_id'),
      checkpointNs: boundedId(config.configurable?.checkpoint_ns ?? '', 'checkpoint_ns', true),
      checkpointId: config.configurable?.checkpoint_id ? boundedId(config.configurable.checkpoint_id, 'checkpoint_id') : '',
    };
  }

  private async tuple(row: CheckpointRow): Promise<CheckpointTuple> {
    if (row.schema_version !== 1) throw new Error('Unsupported graph checkpoint schema version.');
    const writes = await this.all<WriteRow>(
      `SELECT task_id, channel, value_type, value_blob FROM ai_graph_checkpoint_writes
       WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ? ORDER BY task_id, write_idx`,
      [row.thread_id, row.checkpoint_ns, row.checkpoint_id],
    );
    const pendingWrites = await Promise.all(writes.map(async (write) => [
      write.task_id, write.channel, await this.serde.loadsTyped(write.value_type, write.value_blob),
    ] as [string, string, unknown]));
    return {
      config: { configurable: { thread_id: row.thread_id, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.checkpoint_id } },
      checkpoint: await this.serde.loadsTyped(row.checkpoint_type, row.checkpoint_blob),
      metadata: await this.serde.loadsTyped(row.metadata_type, row.metadata_blob),
      pendingWrites,
      ...(row.parent_checkpoint_id ? { parentConfig: { configurable: { thread_id: row.thread_id, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.parent_checkpoint_id } } } : {}),
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    await this.ready;
    const { threadId, checkpointNs, checkpointId } = this.configParts(config);
    const rows = await this.all<CheckpointRow>(
      `SELECT * FROM ai_graph_checkpoints WHERE thread_id = ? AND checkpoint_ns = ?
       ${checkpointId ? 'AND checkpoint_id = ?' : ''}
       ORDER BY checkpoint_id DESC LIMIT 1`,
      checkpointId ? [threadId, checkpointNs, checkpointId] : [threadId, checkpointNs],
    );
    return rows[0] ? this.tuple(rows[0]) : undefined;
  }

  async *list(config: RunnableConfig, options: CheckpointListOptions = {}): AsyncGenerator<CheckpointTuple> {
    await this.ready;
    const { threadId, checkpointNs, checkpointId } = this.configParts(config);
    const beforeId = options.before?.configurable?.checkpoint_id;
    const limit = Math.min(500, Math.max(0, options.limit ?? 100));
    const rows = await this.all<CheckpointRow>(
      `SELECT * FROM ai_graph_checkpoints WHERE thread_id = ? AND checkpoint_ns = ?
       ${checkpointId ? 'AND checkpoint_id = ?' : ''} ${beforeId ? 'AND checkpoint_id < ?' : ''}
       ORDER BY checkpoint_id DESC LIMIT ?`,
      [threadId, checkpointNs, ...(checkpointId ? [checkpointId] : []), ...(beforeId ? [boundedId(beforeId, 'before checkpoint_id')] : []), limit],
    );
    for (const row of rows) {
      const item = await this.tuple(row);
      if (options.filter && !Object.entries(options.filter).every(([key, value]) => (item.metadata as Record<string, unknown> | undefined)?.[key] === value)) continue;
      yield item;
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, _newVersions: ChannelVersions): Promise<RunnableConfig> {
    await this.ready;
    const { threadId, checkpointNs, checkpointId: parentId } = this.configParts(config);
    const checkpointId = boundedId(checkpoint.id, 'checkpoint_id');
    const [[checkpointType, checkpointBlob], [metadataType, metadataBlob]] = await Promise.all([
      this.serde.dumpsTyped(copyCheckpoint(checkpoint)), this.serde.dumpsTyped(metadata),
    ]);
    if (checkpointBlob.byteLength > 120_000 || metadataBlob.byteLength > 20_000) throw new Error('Graph checkpoint exceeds local size budget.');
    await this.run(
      `INSERT OR REPLACE INTO ai_graph_checkpoints
       (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, schema_version, checkpoint_type, checkpoint_blob, metadata_type, metadata_blob, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [threadId, checkpointNs, checkpointId, parentId, checkpointType, Buffer.from(checkpointBlob), metadataType, Buffer.from(metadataBlob), new Date().toISOString()],
    );
    await this.onCheckpoint?.({ id: checkpointId, step: metadata.step, source: metadata.source });
    return { configurable: { thread_id: threadId, checkpoint_ns: checkpointNs, checkpoint_id: checkpointId } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    await this.ready;
    const { threadId, checkpointNs, checkpointId } = this.configParts(config);
    if (!checkpointId) throw new Error('Graph checkpoint writes need a checkpoint_id.');
    const boundedTaskId = boundedId(taskId, 'task_id');
    for (const [index, [channel, value]] of writes.entries()) {
      const writeIdx = WRITES_IDX_MAP[channel] ?? index;
      const [valueType, valueBlob] = await this.serde.dumpsTyped(value);
      if (valueBlob.byteLength > 120_000) throw new Error('Graph checkpoint write exceeds local size budget.');
      await this.run(
        `${writeIdx < 0 ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE'} INTO ai_graph_checkpoint_writes
         (thread_id, checkpoint_ns, checkpoint_id, task_id, write_idx, channel, value_type, value_blob, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [threadId, checkpointNs, checkpointId, boundedTaskId, writeIdx, channel, valueType, Buffer.from(valueBlob), new Date().toISOString()],
      );
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.ready;
    await this.run('DELETE FROM ai_graph_checkpoints WHERE thread_id = ?', [boundedId(threadId, 'thread_id')]);
  }

  async close(): Promise<void> {
    await this.ready;
    await new Promise<void>((resolve, reject) => this.db.close((error) => error ? reject(error) : resolve()));
  }
}
