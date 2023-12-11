import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { escape } from "lodash";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = "registry";

//TODO: Update score, Update S3 bucket
export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(event);

  //input sanitation for metadata, data, and id
  let user_input_metadata = JSON.parse(event.body)?.metadata;
  user_input_metadata = escape(user_input_metadata);
  const doc = new DOMParser().parseFromString(user_input_metadata, "text/html");
  const sanitized_input_metadata = doc.documentElement.textContent || "";
  const metadata = sanitized_input_metadata;
  console.log(metadata);

  let user_input_data = JSON.parse(event.body)?.data;
  user_input_data = escape(user_input_data);
  const doc_data = new DOMParser().parseFromString(
    user_input_data,
    "text/html"
  );
  const sanitized_input_data = doc_data.documentElement.textContent || "";
  const data = sanitized_input_data;
  console.log(data);

  let user_input_id = event.pathParameters?.id;
  user_input_id = escape(user_input_id);
  const doc_id = new DOMParser().parseFromString(user_input_id, "text/html");
  const sanitized_input_id = doc_id.documentElement.textContent || "";
  const id = sanitized_input_id;
  console.log("id: ", id);
  //end of input sanitation

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.",
      }),
    };
  }

  const getCommand = new GetCommand({
    TableName: TableName,
    Key: {
      id: metadata.ID,
    },
  });

  try {
    const result = await docClient.send(getCommand);
    // console.log(result.Item);
    if (result.Item) {
      // Update the item
      let url = { URL: data.URL };
      const Score = await calculateScore(url); // Update Score in DynamoDB
      console.log(Score);

      const binaryData: Buffer = Buffer.from(data.Content, "base64");
      const s3 = new AWS.S3();
      const params = {
        Bucket: "ingested-package-storage",
        Key: `${metadata.name}.zip`,
        Body: binaryData,
      };
      await s3
        .upload(params, (err: Error, data: any) => {
          console.log(err, data);
        })
        .promise();

      const updateCommand = new UpdateCommand({
        TableName: TableName,
        Key: {
          id: metadata.ID,
        },
        UpdateExpression: "set version = :version, ratings = :ratings",
        ExpressionAttributeValues: {
          ":version": metadata.Version,
          ":ratings": JSON.stringify(Score.Score),
        },
      });

      await docClient.send(updateCommand); // Update Version and Content in DynamoDB
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Version is updated" }),
      };
    } else {
      console.log("Package does not exist");
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Package does not exist" }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

async function calculateScore(url: any): Promise<{ Score: any }> {
  const lambda = new AWS.Lambda();
  const params = {
    FunctionName: "RateFunction-RateFunction-tYak9soW0m0J",
    InvocationType: "RequestResponse",
    // LogType: 'Tail',
    Payload: JSON.stringify(url, null, 2),
  };

  try {
    const response = await lambda.invoke(params).promise();
    // console.log('response:', response);
    if (response.StatusCode !== 200) {
      console.log("Error in lambda invoke", response);
      return { Score: 0 };
    }
    // console.log('scores', JSON.parse(response.Payload as string).body.NET_SCORE);
    const score = JSON.parse(response.Payload as string).body;
    const { URL, ...scores } = score;
    return { Score: scores };
  } catch (error) {
    console.error(error);
    return { Score: 0 };
  }
}
