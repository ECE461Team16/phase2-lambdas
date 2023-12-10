import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

const DBclient = new DynamoDBClient()
const DBdocclient = DynamoDBDocumentClient.from(DBclient)
const TABLENAME = "package-registry"

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const Regex = JSON.parse(event.body || "{}").RegEx

    console.log(Regex);

    const params = {
      TableName: TABLENAME,
      ProjectionExpression: "id, version", 
      FilterExpression: "contains(readme, :Regex)",
      ExpressionAttributeValues: {
        ":Regex": { S: Regex },
      }
    };

    try {
        // scan may exceed 1MB, so we need to use pagination
        const scanCommand = new ScanCommand(params)
        const matches = await DBdocclient.send(scanCommand)
        console.log("Found these matches: ", matches.Items)

        return {
            statusCode: 200,
            body: JSON.stringify({
                matches: matches.Items,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
