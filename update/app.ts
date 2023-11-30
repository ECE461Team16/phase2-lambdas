import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import AWS from 'aws-sdk';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = "team17-registry"

//TODO: Update score, Update S3 bucket
export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const metadata = JSON.parse(JSON.stringify(event)).metadata;
  const data = JSON.parse(JSON.stringify(event)).data;

  const getCommand = new GetCommand({
    TableName: TableName,
    Key: {
      "ID": metadata.ID,
    },
  });

  
  try {
    const result = await docClient.send(getCommand);
    // console.log(result.Item);
    if (result.Item) {
      // Update the item
      let url = {"URL": data.URL};    
      const Score = await calculateScore(url);  // Update Score in DynamoDB
      // console.log(Score.Score);
      
      const updateCommand = new UpdateCommand({
        TableName: TableName,
        Key: {
          "ID": metadata.ID,
        },
        UpdateExpression: "set Version = :Version, Content = :Content, Score = :Score",
        ExpressionAttributeValues: {
          ':Version': metadata.Version,
          ':Content': data.Content,
          ':Score': Score.Score,
        },
      });

      await docClient.send(updateCommand);  // Update Version and Content in DynamoDB
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Version is updated' }),
      };
    } else {
      console.log('Package does not exist');
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Package does not exist' }),
      };
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.' }),
    };
  }
}

async function calculateScore(url: any): Promise<{ Score: any }> {
  const lambda = new AWS.Lambda();
    const params = {
    FunctionName: 'RateFunction-RateFunction-tYak9soW0m0J',
    InvocationType: 'RequestResponse',
    // LogType: 'Tail',
    Payload: JSON.stringify(url, null, 2)
    };
    
  try {
    const response = await lambda.invoke(params).promise();
    // console.log('response:', response);
    if (response.StatusCode !== 200) {
      console.log('Error in lambda invoke', response);
      return { Score: 0 };
    }
    const body = JSON.parse(response.Payload).body;
    const {URL, ...score} = body;
    return { Score: score };
  } catch (error) {
    console.error(error)
    return { Score: 0 };
  }
}