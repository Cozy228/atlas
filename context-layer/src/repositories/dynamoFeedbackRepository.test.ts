import { describe, expect, it } from "vitest";
import type { Feedback } from "@atlas/schema";
import { DynamoFeedbackRepository } from "./dynamoFeedbackRepository";

const feedback: Feedback = {
  id: "feedback-1",
  target_type: "topic",
  target_id: "aws-textract",
  feedback_type: "missing",
  message: "Add region guidance.",
  submitted_at: "2026-05-11T00:00:00.000Z",
};

describe("DynamoFeedbackRepository", () => {
  it("writes feedback using stable primary and target index keys", async () => {
    const client = new FakeDocumentClient();
    const repository = new DynamoFeedbackRepository({
      tableName: "atlas-feedback",
      client: client as never,
    });

    await repository.put(feedback);

    expect(client.commands[0]?.constructor.name).toBe("PutCommand");
    expect(client.commands[0]?.input).toMatchObject({
      TableName: "atlas-feedback",
      Item: {
        pk: "FEEDBACK#feedback-1",
        sk: "METADATA",
        gsi1pk: "TARGET#topic#aws-textract",
        gsi1sk: "SUBMITTED#2026-05-11T00:00:00.000Z#feedback-1",
        ...feedback,
      },
    });
  });

  it("queries feedback by target through the target index", async () => {
    const client = new FakeDocumentClient([
      {
        Items: [
          {
            pk: "FEEDBACK#feedback-1",
            sk: "METADATA",
            gsi1pk: "TARGET#topic#aws-textract",
            gsi1sk: "SUBMITTED#2026-05-11T00:00:00.000Z#feedback-1",
            ...feedback,
          },
        ],
      },
    ]);
    const repository = new DynamoFeedbackRepository({
      tableName: "atlas-feedback",
      client: client as never,
    });

    const result = await repository.findByTarget("topic", "aws-textract");

    expect(result).toEqual([feedback]);
    expect(client.commands[0]?.constructor.name).toBe("QueryCommand");
    expect(client.commands[0]?.input).toMatchObject({
      TableName: "atlas-feedback",
      IndexName: "gsi1",
      ExpressionAttributeValues: {
        ":target": "TARGET#topic#aws-textract",
      },
    });
  });
});

class FakeDocumentClient {
  readonly commands: Array<{ constructor: { name: string }; input: unknown }> = [];

  constructor(private readonly responses: unknown[] = [{}]) {}

  async send(command: { constructor: { name: string }; input: unknown }): Promise<unknown> {
    this.commands.push(command);
    return this.responses.shift() ?? {};
  }
}
