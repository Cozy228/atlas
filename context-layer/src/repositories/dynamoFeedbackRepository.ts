import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  type DynamoDBDocumentClient as DynamoDBDocumentClientType,
} from "@aws-sdk/lib-dynamodb";
import { FeedbackSchema, type Feedback, type FeedbackTargetType } from "@atlas/schema";
import type { FeedbackRepository } from "./feedbackRepository.js";

const TARGET_INDEX_NAME = "gsi1";

export type DynamoFeedbackRepositoryInput = {
  tableName: string;
  client?: DynamoDBDocumentClientType;
};

export class DynamoFeedbackRepository implements FeedbackRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClientType;

  constructor(input: DynamoFeedbackRepositoryInput) {
    this.tableName = input.tableName;
    this.client =
      input.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient({}),
        { marshallOptions: { removeUndefinedValues: true } },
      );
  }

  async put(feedback: unknown): Promise<Feedback> {
    const parsed = FeedbackSchema.parse(feedback);
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toDynamoItem(parsed),
      }),
    );
    return parsed;
  }

  async getById(id: string): Promise<Feedback | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: feedbackPk(id), sk: "METADATA" },
      }),
    );
    return parseFeedbackItem(response.Item);
  }

  async list(): Promise<Feedback[]> {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "sk = :metadata",
        ExpressionAttributeValues: {
          ":metadata": "METADATA",
        },
      }),
    );
    return (response.Items ?? []).map((item) => parseFeedbackItem(item)).filter(isFeedback);
  }

  async findByTarget(
    targetType: FeedbackTargetType,
    targetId: string,
  ): Promise<Feedback[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: TARGET_INDEX_NAME,
        KeyConditionExpression: "gsi1pk = :target",
        ExpressionAttributeValues: {
          ":target": targetPk(targetType, targetId),
        },
      }),
    );
    return (response.Items ?? []).map((item) => parseFeedbackItem(item)).filter(isFeedback);
  }
}

export function toDynamoItem(feedback: Feedback): Feedback & {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
} {
  return {
    pk: feedbackPk(feedback.id),
    sk: "METADATA",
    gsi1pk: targetPk(feedback.target_type, feedback.target_id),
    gsi1sk: `SUBMITTED#${feedback.submitted_at}#${feedback.id}`,
    ...feedback,
  };
}

function parseFeedbackItem(item: Record<string, unknown> | undefined): Feedback | undefined {
  if (!item) {
    return undefined;
  }
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...feedback } = item;
  return FeedbackSchema.parse(feedback);
}

function isFeedback(feedback: Feedback | undefined): feedback is Feedback {
  return Boolean(feedback);
}

function feedbackPk(id: string): string {
  return `FEEDBACK#${id}`;
}

function targetPk(targetType: FeedbackTargetType, targetId: string): string {
  return `TARGET#${targetType}#${targetId}`;
}
