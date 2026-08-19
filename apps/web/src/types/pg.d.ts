declare module "pg" {
  export class Client {
    constructor(options: { connectionString: string });
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>;
  }

  export class Pool {
    constructor(options: { connectionString: string; max?: number; idleTimeoutMillis?: number; connectionTimeoutMillis?: number });
  }
}
