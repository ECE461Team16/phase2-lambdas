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
  console.log("===== Deleting from DB =====\n", items)

  // create delete requests for batchwrite
  var deleteRequests: { DeleteRequest: { Key: { [id: string]: any } } }[] = [];
  
  items.forEach((item: any) => {
    deleteRequests.push({ DeleteRequest: { Key: { id: item.Key } } });
  })

  console.log("Delete Requests: \n", deleteRequests);

  // create the batch write parameters
  const params = {
    RequestItems: {
      [TABLENAME]:
        deleteRequests
    }
  }

  console.log("Params: \n", params)

  try {
    const deleteCommand = new BatchWriteCommand(params);
    const delete_results = await DBdocclient.send(deleteCommand)
    console.log("Deleted: \n", delete_results);
  } catch (err) {
    console.log("Error deleting from DynamoDB: ", err);
  }

  return
}

async function deleteItemsFromS3(items: any) {
  console.log("===== Deleting from S3 =====\n", items)

  // create command for deleting from S3
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects: items.map((item: any) => {
        item = item.Key + ".zip"
        console.log("Item {", item, "} from S3\n")
        return { Key: item }
      })
    }
  })

  try {
    const Deleted = await S3client.send(deleteCommand);
    console.log("Deleted: \n", Deleted);
  } catch (err) {
    console.log("Error deleting from S3 Bucket: ", err);
  }
  
  return
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("===== Resetting Registry =====\n")

    // create scan command for DynamoDB
    const scanCommand = new ScanCommand({
      TableName: TABLENAME,
      ProjectionExpression: "id",
      Limit: 25
    });

    let lastKey = null

    try {
      // repeat deleting items from S3 and DB until no more items are found
      do {
        var Scanned = await DBdocclient.send(scanCommand);
        if (Scanned.Count == 0) {
          console.log("No items found in DynamoDB\n");
          return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 200,
            body: 'Registry is reset.'
          }
        }
        console.log("Scanned: \n", Scanned);

        var partitionKeys = Scanned.Items?.map(item => ({ Key: item.id}));
        console.log("Items: \n", partitionKeys);

        if (partitionKeys) {
          await deleteItemsFromS3(partitionKeys);
          await deleteItemsFromDB(partitionKeys);
        }

        lastKey = Scanned.LastEvaluatedKey;

      } while (lastKey)

        return {
          headers: {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          },
          statusCode: 200,
          body: 'Registry is reset.'
        }
    } catch (err) {
        console.log(err);
        return {
          headers: {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
          },
          statusCode: 500,
          body: 'Registry failed to reset.',
      }
    }
};

// check if S3 bucket exists to avoid errors
// verify that packages do exist to avoid errors
// delete all items from S3 bucket
// check if S3 bucket is empty to avoid errors
// delete all items from DynamoDB
// check if DynamoDB is empty to avoid errors