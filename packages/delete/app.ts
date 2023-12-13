import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = "registry"

const S3client = new S3Client({});
const BUCKET = "ingested-package-storage"

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("===== Deleting Package by id =====\n", event)

    const packageID = event.pathParameters?.id

    if (!packageID) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'id is required',
            }),
        };
    }

    const deleteCommandDB = new DeleteItemCommand({
        TableName: TableName,
        Key: {
            id: packageID
        }
    })

    const deleteCommandS3 = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: packageID
    })

    try {
      const resultS3 = await S3client.send(deleteCommandS3)
      const resultDB = await docClient.send(deleteCommandDB)
        console.log("===== Deleting Package by id =====\n", resultDB, resultS3)

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'hello world',
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
