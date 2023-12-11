import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
*
* Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
* @returns {Object} object - API Gateway Lambda Proxy Output Format
*
*/

// Connect to DynamoDB 
const DBclient = new DynamoDBClient({})
const DBdocclient = DynamoDBDocumentClient.from(DBclient)
const TABLENAME = "registry"

// Connect to S3
const S3client = new S3Client({});
const BUCKET = "ingested-package-storage"

async function deleteItemsFromDB(items: any) {

  console.log("===== Deleting from DB =====\n{", items, "}\n")

  var deleteRequests: { DeleteRequest: { Key: { [id: string]: any } } }[] = [];
  
  items.forEach((item: any) => {
    deleteRequests.push({ DeleteRequest: { Key: { id: item.Key } } });
  })

  console.log("Delete Requests {", deleteRequests, "} from DynamoDB\n");

  // Create the batch write parameters
  const params = {
    RequestItems: {
      [TABLENAME]:
        deleteRequests
    }
  }

  console.log("Params {", params, "} from DynamoDB\n")

  const deleteCommand = new BatchWriteCommand(params);
  const delete_results = await DBdocclient.send(deleteCommand) // broken

  console.log("Deleted {", delete_results, "} from DynamoDB\n");

  return
}

async function deleteItemsFromS3(items: any) {

  console.log("===== Deleting from S3 =====\n{", items, "}\n")

  const deleteCommand = new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects: items.map((item: any) => { // VERIFY THIS IS CORRECT
        item = item.Key + ".zip"
        console.log("Item {", item, "} from S3\n")
        return { Key: item }
      })
    }
  })

  try {
    const Deleted = await S3client.send(deleteCommand);
    console.log("Deleted {", Deleted, "} from S3 bucket\n");
  } catch (err) {
    console.log("Error deleting from S3 Bucket: ", err);
  }
  
  return
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // log event for debugging
    // console.log("Received event: ", JSON.stringify(event, null, 2));
    console.log("===== Resetting Registry =====\n")
    const scanCommand = new ScanCommand({
      TableName: TABLENAME,
      ProjectionExpression: "id",
      Limit: 25
    });

    let lastKey = null

    try {
      

      do {
        var Scanned = await DBdocclient.send(scanCommand);
        console.log("Scanned {", Scanned, "} from DynamoDB\n");

        var partitionKeys = Scanned.Items?.map(item => ({ Key: item.id}));
        console.log("Items {", partitionKeys, "} from DynamoDB\n");

        if (partitionKeys) {
          await deleteItemsFromS3(partitionKeys);
          await deleteItemsFromDB(partitionKeys);
        }

        lastKey = Scanned.LastEvaluatedKey;

      } while (lastKey)
      
        return {
          statusCode: 200,
          body: JSON.stringify({
              message: 'Registry is reset.',
          }),
        }
    } catch (err) {
        console.log(err);
        return {
          statusCode: 500,
          body: JSON.stringify({
              message: 'Registry failed to reset',
          }),
      }
    }
};

// check if S3 bucket exists to avoid errors
// verify that packages do exist to avoid errors
// delete all items from S3 bucket
// check if S3 bucket is empty to avoid errors
// delete all items from DynamoDB
// check if DynamoDB is empty to avoid errors