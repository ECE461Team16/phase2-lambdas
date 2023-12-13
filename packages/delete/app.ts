import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
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

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const TABLENAME = "registry"

const S3client = new S3Client({});
const BUCKET = "ingested-package-storage"

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("===== Deleting Package by id =====\n", event)

    var id = event.pathParameters?.id

    console.log("id: ", id)

    // check if id is valid
    if (!id) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.",
            }),
        };
    }

    // Check if package exists
    const getCommand = new GetItemCommand({
      TableName: TABLENAME,
      Key: { id: { S: id } }
    })
    try {
      const getCommandResult = await docClient.send(getCommand)
      console.log("Get Package: \n", getCommandResult)
      if (getCommandResult.Item == undefined) {
        throw new Error("Package does not exist.")
      }
    } catch (err) {
      console.log(err)
      return {
        statusCode: 404,
        body: "Package does not exist."
      }
    }
    
    // DB command
    const deleteCommandDB = new DeleteItemCommand({
      TableName: TABLENAME,
      Key: { id: { S: id } }
    })

    // S3 command
    id = id + ".zip"
    const deleteCommandS3 = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: id
    })

    // attempt to delete package
    try {
      const resultS3 = await S3client.send(deleteCommandS3)
      console.log("Deleting Package S3: \n", resultS3)
      const resultDB = await docClient.send(deleteCommandDB)
      console.log("Deleting Package DB: \n", resultDB)
        return {
            statusCode: 200,
            body: 'Package is deleted.',
        }
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: 'Error occured while trying to Delete package.'
        }
    }
}
